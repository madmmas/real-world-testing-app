import "./env.js";
import { randomBytes } from "node:crypto";
import express, { type Request, type Response } from "express";
import { prisma, type Cart, type CartItem } from "@rwa/db";
import {
  cartItemBody,
  cartItemPatchBody,
  checkoutBody,
  internalCartCheckoutBody,
} from "@rwa/shared/rest";
import {
  createService,
  loadPublicAccount,
  optionalJwt,
  parseBody,
  publicCors,
  requireAdmin,
  requireBuyer,
  requireInternal,
  requireJwt,
  requireSection,
  requireShopUser,
  type AuthedRequest,
} from "@rwa/service-kit";
import { env } from "./env.js";
import {
  clearCart,
  compensateSaga,
  findSagaByOrderId,
  fulfillOrder,
  getSaga,
  listSagasForBuyer,
  peekBook,
  recoverStuckSagas,
  runCheckoutSaga,
  type InventoryBook,
} from "./checkout-saga.js";

const COOKIE = "rwa.cart";
const jwt = { jwtSecret: env.jwtSecret, jwtIssuer: env.jwtIssuer, jwtAudience: env.jwtAudience };
const ttlMs = Math.max(1, env.cartTtlHours) * 60 * 60 * 1000;
const ttlSec = Math.floor(ttlMs / 1000);

const app = createService("order");
app.set("trust proxy", 1);
app.use(publicCors(env.webOrigin, env.adminOrigin));
app.use(express.json());

const optionalAuth = optionalJwt(jwt);
const auth = requireJwt(jwt);
const admin = [auth, requireAdmin()];

type CartRecord = Cart & { items: CartItem[] };

function guestTokenFrom(req: Request) {
  const header = req.headers.cookie ?? "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE) return decodeURIComponent(rest.join("="));
  }
  return "";
}

function setGuestCookie(req: Request, res: Response, token: string) {
  const proto = String(req.headers["x-forwarded-proto"] ?? "");
  const secure = req.secure || proto.split(",")[0]?.trim() === "https";
  const parts = [
    `${COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${ttlSec}`,
  ];
  if (secure) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}

function expiresAt() {
  return new Date(Date.now() + ttlMs);
}

async function pruneExpired() {
  await prisma.cart.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

async function touch(cart: Cart) {
  return prisma.cart.update({
    where: { id: cart.id },
    data: { expiresAt: expiresAt() },
    include: { items: true },
  });
}

async function mergeItems(fromId: string, intoId: string) {
  const [from, into] = await Promise.all([
    prisma.cartItem.findMany({ where: { cartId: fromId } }),
    prisma.cartItem.findMany({ where: { cartId: intoId } }),
  ]);
  const existing = new Map(into.map((item) => [item.bookId, item]));
  for (const item of from) {
    const current = existing.get(item.bookId);
    if (current) {
      await prisma.cartItem.update({
        where: { id: current.id },
        data: { quantity: current.quantity + item.quantity, unitPriceCents: item.unitPriceCents },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: intoId,
          bookId: item.bookId,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
        },
      });
    }
  }
  await prisma.cart.delete({ where: { id: fromId } });
}

async function resolveCart(req: AuthedRequest, res: Response): Promise<CartRecord> {
  await pruneExpired();
  const userId = req.user?.sub;
  const guestToken = guestTokenFrom(req);
  const guestCart = guestToken
    ? await prisma.cart.findUnique({ where: { guestToken }, include: { items: true } })
    : null;

  if (userId) {
    let userCart = await prisma.cart.findUnique({ where: { userId }, include: { items: true } });
    if (guestCart && guestCart.id !== userCart?.id) {
      if (!userCart) {
        userCart = await prisma.cart.update({
          where: { id: guestCart.id },
          data: { userId, guestToken: null, expiresAt: expiresAt() },
          include: { items: true },
        });
      } else {
        await mergeItems(guestCart.id, userCart.id);
        userCart = await prisma.cart.findUniqueOrThrow({
          where: { id: userCart.id },
          include: { items: true },
        });
      }
    }
    if (!userCart) {
      userCart = await prisma.cart.create({
        data: { userId, expiresAt: expiresAt() },
        include: { items: true },
      });
    }
    return touch(userCart);
  }

  if (guestCart) return touch(guestCart);

  const token = randomBytes(24).toString("hex");
  const created = await prisma.cart.create({
    data: { guestToken: token, expiresAt: expiresAt() },
    include: { items: true },
  });
  setGuestCookie(req, res, token);
  return created;
}

async function serialize(cart: CartRecord) {
  const items = await Promise.all(
    cart.items.map(async (item) => {
      try {
        const book = await peekBook(item.bookId);
        return {
          bookId: item.bookId,
          quantity: item.quantity,
          unitPriceCents: book.priceCents,
          title: book.title,
          author: book.author,
          coverUrl: book.coverUrl,
          stock: book.stock,
          storeId: book.storeId,
          storeName: book.store.name,
          available: book.status === "listed" && book.stock >= item.quantity,
        };
      } catch {
        return {
          bookId: item.bookId,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          title: "Unavailable",
          author: "",
          coverUrl: "",
          stock: 0,
          storeId: "",
          storeName: "",
          available: false,
        };
      }
    })
  );
  const totalCents = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  return {
    id: cart.id,
    expiresAt: cart.expiresAt.toISOString(),
    itemCount,
    totalCents,
    items,
  };
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

app.get("/cart", optionalAuth, async (req: AuthedRequest, res) => {
  const cart = await resolveCart(req, res);
  res.json(await serialize(cart));
});

app.post("/cart/items", optionalAuth, async (req: AuthedRequest, res) => {
  const body = parseBody(cartItemBody, req.body, res);
  if (!body) return;
  const cart = await resolveCart(req, res);
  let book: InventoryBook;
  try {
    book = await peekBook(body.bookId);
  } catch {
    return res.status(400).json({ error: "Book is not available" });
  }
  if (book.status !== "listed" || book.stock < 1) {
    return res.status(400).json({ error: "Book is not available" });
  }
  if (req.user?.sub && book.ownerId === req.user.sub) {
    return res.status(400).json({ error: "You cannot buy from your own store" });
  }
  const existing = cart.items.find((item) => item.bookId === book.id);
  const quantity = (existing?.quantity ?? 0) + body.quantity;
  if (quantity > book.stock) {
    return res.status(400).json({ error: "Not enough stock" });
  }
  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity, unitPriceCents: book.priceCents },
    });
  } else {
    await prisma.cartItem.create({
      data: { cartId: cart.id, bookId: book.id, quantity, unitPriceCents: book.priceCents },
    });
  }
  const next = await prisma.cart.findUniqueOrThrow({ where: { id: cart.id }, include: { items: true } });
  res.json(await serialize(next));
});

app.patch("/cart/items/:bookId", optionalAuth, async (req: AuthedRequest, res) => {
  const body = parseBody(cartItemPatchBody, req.body, res);
  if (!body) return;
  const cart = await resolveCart(req, res);
  const existing = cart.items.find((item) => item.bookId === req.params.bookId);
  if (!existing) return res.status(404).json({ error: "Not in cart" });
  if (body.quantity < 1) {
    await prisma.cartItem.delete({ where: { id: existing.id } });
  } else {
    await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: body.quantity } });
  }
  const next = await prisma.cart.findUniqueOrThrow({ where: { id: cart.id }, include: { items: true } });
  res.json(await serialize(next));
});

app.delete("/cart/items/:bookId", optionalAuth, async (req: AuthedRequest, res) => {
  const cart = await resolveCart(req, res);
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id, bookId: req.params.bookId } });
  const next = await prisma.cart.findUniqueOrThrow({ where: { id: cart.id }, include: { items: true } });
  res.json(await serialize(next));
});

app.post("/cart/checkout", auth, async (req: AuthedRequest, res) => {
  const buyer = await requireBuyer(req, res);
  if (!buyer) return;
  const cart = await resolveCart(req, res);
  if (cart.items.length === 0) return res.status(400).json({ error: "Cart is empty" });
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
  try {
    const payment = await runCheckoutSaga({
      buyerId: buyer.id,
      cartId: cart.id,
      items: cart.items.map((item) => ({ bookId: item.bookId, quantity: item.quantity })),
      idempotencyKey,
    });
    if (payment.mode === "demo") await clearCart(cart.id);
    res.json(payment);
  } catch (error) {
    res.status((error as { status?: number }).status ?? 400).json({
      error: error instanceof Error ? error.message : "Checkout failed",
    });
  }
});

app.post("/internal/carts/:id/clear", requireInternal(env.internalSecret), async (req, res) => {
  await clearCart(req.params.id);
  res.json({ ok: true });
});

app.post("/checkout", auth, async (req: AuthedRequest, res) => {
  const buyer = await requireBuyer(req, res);
  if (!buyer) return;
  const body = parseBody(checkoutBody, req.body, res);
  if (!body) return;
  const idempotencyKey = String(req.header("idempotency-key") ?? "").trim();
  if (idempotencyKey) {
    const prior = await prisma.checkoutIdempotency.findUnique({ where: { key: idempotencyKey } });
    if (prior) {
      if (prior.userId !== buyer.id || prior.bookId !== body.bookId || prior.quantity !== body.quantity) {
        return res.status(409).json({ error: "Idempotency-Key was reused with a different request" });
      }
      return res.json(prior.response);
    }
  }
  try {
    const payload = await runCheckoutSaga({
      buyerId: buyer.id,
      items: [{ bookId: body.bookId, quantity: body.quantity ?? 1 }],
      idempotencyKey,
    });
    res.json(payload);
  } catch (error) {
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

app.get("/internal/sagas", requireInternal(env.internalSecret), async (req, res) => {
  const orderId = String(req.query.orderId ?? "").trim();
  const buyerId = String(req.query.buyerId ?? "").trim();
  if (orderId) {
    const saga = await findSagaByOrderId(orderId);
    if (!saga) return res.status(404).json({ error: "Not found" });
    return res.json({ saga });
  }
  if (buyerId) {
    return res.json({ sagas: await listSagasForBuyer(buyerId) });
  }
  return res.status(400).json({ error: "orderId or buyerId is required" });
});

app.get("/internal/sagas/:id", requireInternal(env.internalSecret), async (req, res) => {
  const saga = await getSaga(req.params.id);
  if (!saga) return res.status(404).json({ error: "Not found" });
  res.json({ saga });
});

app.post("/internal/sagas/:id/compensate", requireInternal(env.internalSecret), async (req, res) => {
  await compensateSaga(req.params.id, new Error("Manual compensate"));
  const saga = await getSaga(req.params.id);
  if (!saga) return res.status(404).json({ error: "Not found" });
  res.json({ saga });
});

app.post("/internal/fulfill/:id", requireInternal(env.internalSecret), async (req, res) => {
  await fulfillOrder(req.params.id);
  res.json({ ok: true });
});

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
  try {
    const payload = await runCheckoutSaga({
      buyerId: buyer.id,
      cartId: body.cartId,
      items: body.items,
      idempotencyKey,
    });
    res.json(payload);
  } catch (error) {
    res.status((error as { status?: number }).status ?? 400).json({
      error: error instanceof Error ? error.message : "Checkout failed",
    });
  }
});

setInterval(() => {
  void pruneExpired();
}, 60_000).unref();

app.listen(env.port, () => {
  console.log(`Order service listening on http://localhost:${env.port}`);
  void recoverStuckSagas().catch((error) => {
    console.error("checkout saga recovery failed", error);
  });
});
