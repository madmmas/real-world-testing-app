import "./env.js";
import express from "express";
import { prisma } from "@rwa/db";
import { checkoutBody, internalCartCheckoutBody } from "@rwa/shared/rest";
import {
  createService,
  loadPublicAccount,
  parseBody,
  publicCors,
  requireAdmin,
  requireBuyer,
  requireInternal,
  requireJwt,
  requireSection,
  requireShopUser,
  serviceFetch,
  type AuthedRequest,
} from "@rwa/service-kit";
import { env } from "./env.js";

const jwt = { jwtSecret: env.jwtSecret, jwtIssuer: env.jwtIssuer, jwtAudience: env.jwtAudience };
const app = createService("sales");
app.use(publicCors(env.webOrigin, env.adminOrigin));
app.use(express.json());
const auth = requireJwt(jwt);
const admin = [auth, requireAdmin()];

function platformFee(totalCents: number) {
  return Math.round((totalCents * env.platformFeeBps) / 10_000);
}

function mapBuyerOrder(order: {
  id: string;
  status: string;
  totalCents: number;
  createdAt: Date;
  store: { name: string };
  items: { book: { title: string } }[];
}) {
  return {
    id: order.id,
    status: order.status,
    totalCents: order.totalCents,
    storeName: order.store.name,
    createdAt: order.createdAt.toISOString(),
    title: order.items[0]?.book.title ?? "Order",
  };
}

async function fulfillOrder(orderId: string) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || order.status === "paid" || order.status === "fulfilled") return;
    for (const item of order.items) {
      const book = await tx.book.update({
        where: { id: item.bookId },
        data: { stock: { decrement: item.quantity } },
      });
      if (book.stock <= 0) {
        await tx.book.update({ where: { id: book.id }, data: { stock: 0, status: "sold_out" } });
      }
    }
    await tx.order.update({ where: { id: order.id }, data: { status: "paid" } });
  });
  const paid = await prisma.order.findUnique({ where: { id: orderId } });
  if (paid?.cartId) {
    try {
      await serviceFetch(env.cartServiceUrl, `/internal/carts/${paid.cartId}/clear`, {
        method: "POST",
        internalSecret: env.internalSecret,
      });
    } catch {
      // leftover lines still expire with the cart TTL
    }
  }
}

app.post("/checkout", auth, async (req: AuthedRequest, res) => {
  const buyer = await requireBuyer(req, res);
  if (!buyer) return;
  const body = parseBody(checkoutBody, req.body, res);
  if (!body) return;
  const bookId = body.bookId;
  const quantity = body.quantity ?? 1;
  const idempotencyKey = String(req.header("idempotency-key") ?? "").trim();

  if (idempotencyKey) {
    const prior = await prisma.checkoutIdempotency.findUnique({ where: { key: idempotencyKey } });
    if (prior) {
      if (prior.userId !== buyer.id || prior.bookId !== bookId || prior.quantity !== quantity) {
        return res.status(409).json({ error: "Idempotency-Key was reused with a different request" });
      }
      return res.json(prior.response);
    }
  }

  let catalog: {
    book: {
      id: string;
      title: string;
      author: string;
      priceCents: number;
      stock: number;
      status: string;
      storeId: string;
      ownerId: string;
      store: { stripeAccountId?: string; stripeOnboarded: boolean };
    };
  };
  try {
    catalog = await serviceFetch(env.booksServiceUrl, `/internal/books/${bookId}/reserve`, {
      method: "POST",
      internalSecret: env.internalSecret,
    });
  } catch {
    return res.status(400).json({ error: "Book is not available" });
  }
  const book = catalog.book;
  if (book.status !== "listed" || book.stock < quantity) {
    return res.status(400).json({ error: "Book is not available" });
  }
  if (book.ownerId === buyer.id) {
    return res.status(400).json({ error: "You cannot buy from your own store" });
  }

  const totalCents = book.priceCents * quantity;
  const fee = platformFee(totalCents);
  const order = await prisma.order.create({
    data: {
      storeId: book.storeId,
      buyerId: buyer.id,
      status: "pending",
      totalCents,
      platformFeeCents: fee,
      items: { create: { bookId: book.id, quantity, unitPriceCents: book.priceCents } },
    },
  });

  try {
    const payment = await serviceFetch<{ mode: string; checkoutUrl: string | null; sessionId?: string }>(
      env.paymentServiceUrl,
      "/checkout-sessions",
      {
        method: "POST",
        internalSecret: env.internalSecret,
        body: JSON.stringify({
          orderId: order.id,
          bookId: book.id,
          title: book.title,
          author: book.author,
          priceCents: book.priceCents,
          quantity,
          fee,
          stripeAccountId: book.store.stripeAccountId,
          stripeOnboarded: book.store.stripeOnboarded,
        }),
      }
    );
    if (payment.sessionId) {
      await prisma.order.update({
        where: { id: order.id },
        data: { stripeCheckoutSession: payment.sessionId },
      });
    }
    if (payment.mode === "demo") await fulfillOrder(order.id);
    const payload = { mode: payment.mode, checkoutUrl: payment.checkoutUrl };
    if (idempotencyKey) {
      try {
        await prisma.checkoutIdempotency.create({
          data: {
            key: idempotencyKey,
            userId: buyer.id,
            bookId,
            quantity,
            orderId: order.id,
            response: payload,
          },
        });
      } catch {
        const raced = await prisma.checkoutIdempotency.findUnique({ where: { key: idempotencyKey } });
        if (raced) return res.json(raced.response);
      }
    }
    res.json(payload);
  } catch (error) {
    await prisma.order.update({ where: { id: order.id }, data: { status: "cancelled" } });
    res.status((error as { status?: number }).status ?? 400).json({
      error: error instanceof Error ? error.message : "Checkout failed",
    });
  }
});

app.get("/me/orders", auth, async (req: AuthedRequest, res) => {
  if (!(await requireBuyer(req, res))) return;
  const orders = await prisma.order.findMany({
    where: { buyerId: req.user!.sub },
    include: { store: true, items: { include: { book: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({ orders: orders.map(mapBuyerOrder) });
});

app.get("/me/sales", auth, async (req: AuthedRequest, res) => {
  if (!(await requireShopUser(req, res))) return;
  const member = await prisma.storeMember.findFirst({ where: { userId: req.user!.sub } });
  if (!member) return res.json({ orders: [] });
  const orders = await prisma.order.findMany({
    where: { storeId: member.storeId },
    include: { buyer: true, items: { include: { book: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({
    orders: orders.map((order) => ({
      id: order.id,
      status: order.status,
      totalCents: order.totalCents,
      storeName: order.buyer.username,
      createdAt: order.createdAt.toISOString(),
      title: order.items[0]?.book.title ?? "Order",
    })),
  });
});

app.get("/admin/stats", ...admin, requireSection("stats"), async (_req, res) => {
  res.json({ orders: await prisma.order.count() });
});

app.get("/admin/orders", ...admin, requireSection("orders"), async (_req, res) => {
  const orders = await prisma.order.findMany({
    include: { store: true, buyer: true, items: { include: { book: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json({
    orders: orders.map((order) => ({
      id: order.id,
      status: order.status,
      totalCents: order.totalCents,
      platformFeeCents: order.platformFeeCents,
      storeName: order.store.name,
      buyer: order.buyer.username,
      createdAt: order.createdAt.toISOString(),
      title: order.items[0]?.book.title ?? "Order",
    })),
  });
});

app.post("/internal/fulfill/:id", requireInternal(env.internalSecret), async (req, res) => {
  await fulfillOrder(req.params.id);
  res.json({ ok: true });
});

type CatalogBook = {
  id: string;
  title: string;
  author: string;
  priceCents: number;
  stock: number;
  status: string;
  storeId: string;
  ownerId: string;
  store: { stripeAccountId?: string; stripeOnboarded: boolean };
};

async function loadBook(bookId: string) {
  const catalog = await serviceFetch<{ book: CatalogBook }>(env.booksServiceUrl, `/internal/books/${bookId}/reserve`, {
    method: "POST",
    internalSecret: env.internalSecret,
  });
  return catalog.book;
}

app.post("/internal/checkout", requireInternal(env.internalSecret), async (req, res) => {
  const body = parseBody(internalCartCheckoutBody, req.body, res);
  if (!body) return;
  const buyer = await loadPublicAccount(body.buyerId);
  if (!buyer) return res.status(403).json({ error: "Authenticated user role required" });
  const idempotencyKey = String(req.header("idempotency-key") ?? "").trim();
  if (idempotencyKey) {
    const prior = await prisma.checkoutIdempotency.findUnique({ where: { key: idempotencyKey } });
    if (prior) {
      if (prior.userId !== buyer.id) {
        return res.status(409).json({ error: "Idempotency-Key was reused with a different request" });
      }
      return res.json(prior.response);
    }
  }

  const lines: { book: CatalogBook; quantity: number }[] = [];
  try {
    for (const item of body.items) {
      const book = await loadBook(item.bookId);
      if (book.status !== "listed" || book.stock < item.quantity) {
        return res.status(400).json({ error: "Book is not available" });
      }
      if (book.ownerId === buyer.id) {
        return res.status(400).json({ error: "You cannot buy from your own store" });
      }
      lines.push({ book, quantity: item.quantity });
    }
  } catch {
    return res.status(400).json({ error: "Book is not available" });
  }

  const byStore = new Map<string, { book: CatalogBook; quantity: number }[]>();
  for (const line of lines) {
    const group = byStore.get(line.book.storeId) ?? [];
    group.push(line);
    byStore.set(line.book.storeId, group);
  }

  const paymentConfig = await serviceFetch<{ checkoutMode?: string }>(env.paymentServiceUrl, "/config");
  if (byStore.size > 1 && paymentConfig.checkoutMode === "stripe") {
    return res.status(400).json({ error: "Pay for one seller at a time when Stripe checkout is on" });
  }

  const created: { id: string; storeId: string }[] = [];
  try {
    for (const [storeId, storeLines] of byStore) {
      const totalCents = storeLines.reduce((sum, line) => sum + line.book.priceCents * line.quantity, 0);
      const fee = platformFee(totalCents);
      const order = await prisma.order.create({
        data: {
          storeId,
          buyerId: buyer.id,
          status: "pending",
          totalCents,
          platformFeeCents: fee,
          cartId: body.cartId,
          items: {
            create: storeLines.map((line) => ({
              bookId: line.book.id,
              quantity: line.quantity,
              unitPriceCents: line.book.priceCents,
            })),
          },
        },
      });
      created.push({ id: order.id, storeId });
      const head = storeLines[0]!.book;
      const payment = await serviceFetch<{ mode: string; checkoutUrl: string | null; sessionId?: string }>(
        env.paymentServiceUrl,
        "/checkout-sessions",
        {
          method: "POST",
          internalSecret: env.internalSecret,
          body: JSON.stringify({
            orderId: order.id,
            bookId: head.id,
            fee,
            stripeAccountId: head.store.stripeAccountId,
            stripeOnboarded: head.store.stripeOnboarded,
            cancelUrl: `${env.webOrigin}/cart`,
            successUrl: `${env.webOrigin}/orders?paid=1`,
            items: storeLines.map((line) => ({
              title: line.book.title,
              author: line.book.author,
              priceCents: line.book.priceCents,
              quantity: line.quantity,
            })),
          }),
        }
      );
      if (payment.sessionId) {
        await prisma.order.update({
          where: { id: order.id },
          data: { stripeCheckoutSession: payment.sessionId },
        });
      }
      if (payment.mode === "demo") await fulfillOrder(order.id);
      if (byStore.size === 1) {
        const payload = { mode: payment.mode, checkoutUrl: payment.checkoutUrl };
        if (idempotencyKey) {
          try {
            await prisma.checkoutIdempotency.create({
              data: {
                key: idempotencyKey,
                userId: buyer.id,
                bookId: `cart:${body.cartId ?? order.id}`,
                quantity: body.items.reduce((sum, item) => sum + item.quantity, 0),
                orderId: order.id,
                response: payload,
              },
            });
          } catch {
            const raced = await prisma.checkoutIdempotency.findUnique({ where: { key: idempotencyKey } });
            if (raced) return res.json(raced.response);
          }
        }
        return res.json(payload);
      }
    }
    const payload = { mode: "demo", checkoutUrl: null as string | null };
    if (idempotencyKey && created[0]) {
      try {
        await prisma.checkoutIdempotency.create({
          data: {
            key: idempotencyKey,
            userId: buyer.id,
            bookId: `cart:${body.cartId ?? created[0].id}`,
            quantity: body.items.reduce((sum, item) => sum + item.quantity, 0),
            orderId: created[0].id,
            response: payload,
          },
        });
      } catch {
        const raced = await prisma.checkoutIdempotency.findUnique({ where: { key: idempotencyKey } });
        if (raced) return res.json(raced.response);
      }
    }
    return res.json(payload);
  } catch (error) {
    for (const order of created) {
      await prisma.order.update({ where: { id: order.id }, data: { status: "cancelled" } });
    }
    res.status((error as { status?: number }).status ?? 400).json({
      error: error instanceof Error ? error.message : "Checkout failed",
    });
  }
});

app.listen(env.port, () => {
  console.log(`Sales service listening on http://localhost:${env.port}`);
});
