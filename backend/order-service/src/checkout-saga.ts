import { Prisma, prisma, writeAudit, type CheckoutSaga, type CheckoutSagaStep, type Order } from "@rwa/db";
import { serviceFetch } from "@rwa/service-kit";
import { env } from "./env.js";

export class CheckoutError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type CheckoutResult = { mode: string; checkoutUrl: string | null };

export type InventoryBook = {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  priceCents: number;
  stock: number;
  status: string;
  storeId: string;
  ownerId: string;
  store: { name: string; stripeAccountId?: string; stripeOnboarded: boolean };
};

type Line = { book: InventoryBook; quantity: number };

type SagaPayload = {
  items: { bookId: string; quantity: number }[];
  cartId?: string;
  idempotencyKey: string;
  lines?: Line[];
  reserved?: { bookId: string; quantity: number }[];
  orderIds?: string[];
  payment?: CheckoutResult;
};

type SagaRecord = CheckoutSaga & {
  steps: CheckoutSagaStep[];
  orders: Pick<Order, "id" | "status">[];
};

const STEP_VALIDATE = "validate";
const STEP_RESERVE = "reserve";
const STEP_CREATE_ORDERS = "create_orders";
const STEP_PAYMENT = "payment";
const STEP_COMPLETE = "complete";

function platformFee(totalCents: number) {
  return Math.round((totalCents * env.platformFeeBps) / 10_000);
}

function asPayload(value: unknown): SagaPayload {
  return (value ?? {}) as SagaPayload;
}

function groupByStore(lines: Line[]) {
  const byStore = new Map<string, Line[]>();
  for (const line of lines) {
    const group = byStore.get(line.book.storeId) ?? [];
    group.push(line);
    byStore.set(line.book.storeId, group);
  }
  return byStore;
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function httpStatus(error: unknown, fallback = 400) {
  return (error as { status?: number }).status ?? fallback;
}

export async function peekBook(bookId: string) {
  const data = await serviceFetch<{ book: InventoryBook }>(env.inventoryServiceUrl, `/internal/books/${bookId}`, {
    method: "POST",
    internalSecret: env.internalSecret,
    body: JSON.stringify({}),
  });
  return data.book;
}

async function reserveBook(bookId: string, quantity: number) {
  const data = await serviceFetch<{ book: InventoryBook }>(
    env.inventoryServiceUrl,
    `/internal/books/${bookId}/reserve`,
    {
      method: "POST",
      internalSecret: env.internalSecret,
      body: JSON.stringify({ quantity }),
    }
  );
  return data.book;
}

async function releaseItems(items: { bookId: string; quantity: number }[]) {
  if (!items.length) return;
  await serviceFetch(env.inventoryServiceUrl, "/internal/release", {
    method: "POST",
    internalSecret: env.internalSecret,
    body: JSON.stringify({ items }),
  });
}

export async function clearCart(cartId: string) {
  await prisma.cartItem.deleteMany({ where: { cartId } });
}

async function markPaid(orderId: string) {
  await prisma.order.updateMany({
    where: { id: orderId, status: { notIn: ["paid", "fulfilled"] } },
    data: { status: "paid" },
  });
  const paid = await prisma.order.findUnique({ where: { id: orderId } });
  if (paid?.cartId) await clearCart(paid.cartId);
  return paid;
}

async function completeSagaIfPaid(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order?.sagaId) return;
  const siblings = await prisma.order.findMany({ where: { sagaId: order.sagaId } });
  if (siblings.some((row) => row.status !== "paid" && row.status !== "fulfilled")) return;
  await prisma.checkoutSaga.updateMany({
    where: { id: order.sagaId, status: { in: ["awaiting_payment", "running"] } },
    data: { status: "completed", currentStep: STEP_COMPLETE },
  });
}

export async function fulfillOrder(orderId: string) {
  await markPaid(orderId);
  await completeSagaIfPaid(orderId);
}

async function recordStep(
  sagaId: string,
  name: string,
  status: "done" | "compensated" | "failed",
  data?: unknown,
  error?: string
) {
  await prisma.checkoutSagaStep.create({
    data: {
      sagaId,
      name,
      status,
      data: data === undefined ? undefined : json(data),
      error,
    },
  });
}

async function savePayload(sagaId: string, payload: SagaPayload, currentStep?: string) {
  await prisma.checkoutSaga.update({
    where: { id: sagaId },
    data: {
      payload: json(payload),
      ...(currentStep ? { currentStep } : {}),
    },
  });
}

async function loadSaga(id: string): Promise<SagaRecord | null> {
  return prisma.checkoutSaga.findUnique({
    where: { id },
    include: {
      steps: { orderBy: { createdAt: "asc" } },
      orders: { select: { id: true, status: true } },
    },
  });
}

export function serializeSaga(saga: SagaRecord) {
  const payload = asPayload(saga.payload);
  return {
    id: saga.id,
    buyerId: saga.buyerId,
    cartId: saga.cartId,
    status: saga.status,
    currentStep: saga.currentStep,
    error: saga.error,
    result: saga.result,
    reserved: payload.reserved ?? [],
    orderIds: saga.orders.map((order) => order.id),
    steps: saga.steps.map((step) => ({
      name: step.name,
      status: step.status,
      error: step.error,
      createdAt: step.createdAt.toISOString(),
    })),
    createdAt: saga.createdAt.toISOString(),
    modifiedAt: saga.modifiedAt.toISOString(),
  };
}

export async function getSaga(id: string) {
  const saga = await loadSaga(id);
  return saga ? serializeSaga(saga) : null;
}

export async function findSagaByOrderId(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order?.sagaId) return null;
  return getSaga(order.sagaId);
}

export async function listSagasForBuyer(buyerId: string) {
  const sagas = await prisma.checkoutSaga.findMany({
    where: { buyerId },
    include: {
      steps: { orderBy: { createdAt: "asc" } },
      orders: { select: { id: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return sagas.map(serializeSaga);
}

async function runValidate(sagaId: string, buyerId: string, payload: SagaPayload) {
  await savePayload(sagaId, payload, STEP_VALIDATE);
  const lines: Line[] = [];
  for (const item of payload.items) {
    let book: InventoryBook;
    try {
      book = await peekBook(item.bookId);
    } catch (error) {
      throw new CheckoutError(
        error instanceof Error ? error.message : "Book is not available",
        httpStatus(error)
      );
    }
    if (book.status !== "listed" || book.stock < item.quantity) {
      throw new CheckoutError("Book is not available", 400);
    }
    if (book.ownerId === buyerId) {
      throw new CheckoutError("You cannot buy from your own store", 400);
    }
    lines.push({ book, quantity: item.quantity });
  }

  const byStore = groupByStore(lines);
  const paymentConfig = await serviceFetch<{ checkoutMode?: string }>(env.paymentServiceUrl, "/config");
  if (byStore.size > 1 && paymentConfig.checkoutMode === "stripe") {
    throw new CheckoutError("Pay for one seller at a time when Stripe checkout is on", 400);
  }

  payload.lines = lines;
  await savePayload(sagaId, payload);
  await recordStep(sagaId, STEP_VALIDATE, "done", {
    bookIds: lines.map((line) => line.book.id),
    storeCount: byStore.size,
  });
}

async function runReserve(sagaId: string, payload: SagaPayload) {
  await savePayload(sagaId, payload, STEP_RESERVE);
  const reserved: { bookId: string; quantity: number }[] = [];
  try {
    for (const line of payload.lines ?? []) {
      const book = await reserveBook(line.book.id, line.quantity);
      reserved.push({ bookId: book.id, quantity: line.quantity });
      line.book = book;
      payload.reserved = reserved;
      await savePayload(sagaId, payload);
    }
  } catch (error) {
    payload.reserved = reserved;
    await savePayload(sagaId, payload);
    throw new CheckoutError(
      error instanceof Error ? error.message : "Book is not available",
      httpStatus(error)
    );
  }
  await recordStep(sagaId, STEP_RESERVE, "done", { reserved });
}

async function runCreateOrders(sagaId: string, buyerId: string, payload: SagaPayload) {
  await savePayload(sagaId, payload, STEP_CREATE_ORDERS);
  const orderIds: string[] = [];
  for (const [storeId, storeLines] of groupByStore(payload.lines ?? [])) {
    const totalCents = storeLines.reduce((sum, line) => sum + line.book.priceCents * line.quantity, 0);
    const order = await prisma.order.create({
      data: {
        storeId,
        buyerId,
        status: "pending",
        totalCents,
        platformFeeCents: platformFee(totalCents),
        cartId: payload.cartId,
        sagaId,
        items: {
          create: storeLines.map((line) => ({
            bookId: line.book.id,
            quantity: line.quantity,
            unitPriceCents: line.book.priceCents,
          })),
        },
      },
    });
    orderIds.push(order.id);
    payload.orderIds = orderIds;
    await savePayload(sagaId, payload);
  }
  await recordStep(sagaId, STEP_CREATE_ORDERS, "done", { orderIds });
}

async function runPayment(sagaId: string, payload: SagaPayload) {
  await savePayload(sagaId, payload, STEP_PAYMENT);
  const byStore = groupByStore(payload.lines ?? []);
  const orderIds = payload.orderIds ?? [];
  let lastPayment: CheckoutResult = { mode: "demo", checkoutUrl: null };
  let index = 0;
  for (const [, storeLines] of byStore) {
    const orderId = orderIds[index++]!;
    const head = storeLines[0]!.book;
    const fee = platformFee(storeLines.reduce((sum, line) => sum + line.book.priceCents * line.quantity, 0));
    const payment = await serviceFetch<{ mode: string; checkoutUrl: string | null; sessionId?: string }>(
      env.paymentServiceUrl,
      "/checkout-sessions",
      {
        method: "POST",
        internalSecret: env.internalSecret,
        body: JSON.stringify({
          orderId,
          bookId: head.id,
          title: head.title,
          author: head.author,
          priceCents: head.priceCents,
          quantity: storeLines[0]!.quantity,
          fee,
          stripeAccountId: head.store.stripeAccountId,
          stripeOnboarded: head.store.stripeOnboarded,
          ...(payload.cartId
            ? {
                cancelUrl: `${env.webOrigin}/cart`,
                successUrl: `${env.webOrigin}/orders?paid=1`,
              }
            : {}),
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
        where: { id: orderId },
        data: { stripeCheckoutSession: payment.sessionId },
      });
    }
    lastPayment = { mode: payment.mode, checkoutUrl: payment.checkoutUrl };
  }
  payload.payment = byStore.size === 1 ? lastPayment : { mode: "demo", checkoutUrl: null };
  await savePayload(sagaId, payload);
  await recordStep(sagaId, STEP_PAYMENT, "done", payload.payment);
}

async function persistIdempotency(buyerId: string, payload: SagaPayload, result: CheckoutResult) {
  if (!payload.idempotencyKey || !payload.orderIds?.[0]) return result;
  try {
    await prisma.checkoutIdempotency.create({
      data: {
        key: payload.idempotencyKey,
        userId: buyerId,
        bookId: payload.cartId ? `cart:${payload.cartId}` : payload.items[0]!.bookId,
        quantity: payload.items.reduce((sum, item) => sum + item.quantity, 0),
        orderId: payload.orderIds[0],
        response: json(result),
      },
    });
    return result;
  } catch {
    const raced = await prisma.checkoutIdempotency.findUnique({ where: { key: payload.idempotencyKey } });
    if (raced) return raced.response as CheckoutResult;
    return result;
  }
}

async function runComplete(sagaId: string, buyerId: string, payload: SagaPayload) {
  await savePayload(sagaId, payload, STEP_COMPLETE);
  const payment = payload.payment ?? { mode: "demo", checkoutUrl: null };
  const result = await persistIdempotency(buyerId, payload, payment);
  const status = result.mode === "demo" ? "completed" : "awaiting_payment";
  await prisma.checkoutSaga.update({
    where: { id: sagaId },
    data: {
      status,
      currentStep: STEP_COMPLETE,
      result: json(result),
      payload: json(payload),
    },
  });
  await recordStep(sagaId, STEP_COMPLETE, "done", { status, payment: result });
  if (result.mode === "demo") {
    for (const orderId of payload.orderIds ?? []) {
      await markPaid(orderId);
    }
  }
  await writeAudit({
    actorId: buyerId,
    action: "checkout.saga.complete",
    resource: "CheckoutSaga",
    resourceId: sagaId,
    meta: { status },
  });
  return result;
}

export async function compensateSaga(sagaId: string, cause?: unknown) {
  const saga = await loadSaga(sagaId);
  if (!saga) return;
  if (saga.status === "completed" || saga.status === "awaiting_payment" || saga.status === "compensated") {
    return;
  }

  const message = cause instanceof Error ? cause.message : String(cause ?? "Checkout failed");
  await prisma.checkoutSaga.update({
    where: { id: sagaId },
    data: { status: "compensating", error: message },
  });

  const payload = asPayload(saga.payload);
  const orderIds = payload.orderIds?.length ? payload.orderIds : saga.orders.map((order) => order.id);
  const reserved = payload.reserved ?? [];
  const alreadyPaid = orderIds.length
    ? await prisma.order.count({
        where: { id: { in: orderIds }, status: { in: ["paid", "fulfilled"] } },
      })
    : 0;

  try {
    if (orderIds.length) {
      for (const orderId of orderIds) {
        await prisma.order.updateMany({
          where: { id: orderId, status: { notIn: ["paid", "fulfilled"] } },
          data: { status: "cancelled" },
        });
      }
      await recordStep(sagaId, STEP_CREATE_ORDERS, "compensated", { orderIds });
    }
    if (reserved.length && alreadyPaid === 0) {
      try {
        await releaseItems(reserved);
      } catch {
        // inventory may already have been released; still mark compensated if cancel succeeded
      }
      await recordStep(sagaId, STEP_RESERVE, "compensated", { reserved });
    }
    await prisma.checkoutSaga.update({
      where: { id: sagaId },
      data: { status: "compensated", error: message },
    });
    await writeAudit({
      actorId: saga.buyerId,
      action: "checkout.saga.compensate",
      resource: "CheckoutSaga",
      resourceId: sagaId,
      meta: { error: message },
    });
  } catch (error) {
    const failed = error instanceof Error ? error.message : "Compensation failed";
    await prisma.checkoutSaga.update({
      where: { id: sagaId },
      data: { status: "failed", error: failed },
    });
    await recordStep(sagaId, saga.currentStep, "failed", undefined, failed);
  }
}

export async function recoverStuckSagas() {
  const stuck = await prisma.checkoutSaga.findMany({
    where: { status: { in: ["running", "compensating"] } },
    select: { id: true },
  });
  for (const saga of stuck) {
    await compensateSaga(saga.id, new Error("Recovered after restart"));
  }
}

export async function runCheckoutSaga(args: {
  buyerId: string;
  items: { bookId: string; quantity: number }[];
  cartId?: string;
  idempotencyKey: string;
}): Promise<CheckoutResult> {
  const payload: SagaPayload = {
    items: args.items,
    cartId: args.cartId,
    idempotencyKey: args.idempotencyKey,
  };
  const saga = await prisma.checkoutSaga.create({
    data: {
      buyerId: args.buyerId,
      cartId: args.cartId,
      status: "running",
      currentStep: STEP_VALIDATE,
      payload: json(payload),
    },
  });

  try {
    await runValidate(saga.id, args.buyerId, payload);
    await runReserve(saga.id, payload);
    await runCreateOrders(saga.id, args.buyerId, payload);
    await runPayment(saga.id, payload);
    return await runComplete(saga.id, args.buyerId, payload);
  } catch (error) {
    await compensateSaga(saga.id, error);
    if (error instanceof CheckoutError) throw error;
    throw new CheckoutError(error instanceof Error ? error.message : "Checkout failed", httpStatus(error, 502));
  }
}
