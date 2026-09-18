import "./env.js";
import express from "express";
import { prisma } from "@rwa/db";
import { checkoutBody } from "@rwa/shared/rest";
import {
  createService,
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

app.listen(env.port, () => {
  console.log(`Sales service listening on http://localhost:${env.port}`);
});
