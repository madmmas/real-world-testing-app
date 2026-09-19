import "./env.js";
import express from "express";
import Stripe from "stripe";
import { prisma } from "@rwa/db";
import {
  createService,
  publicCors,
  requireInternal,
  requireJwt,
  requireShopUser,
  serviceFetch,
  type AuthedRequest,
} from "@rwa/service-kit";
import { env, stripeEnabled } from "./env.js";

const jwt = { jwtSecret: env.jwtSecret, jwtIssuer: env.jwtIssuer, jwtAudience: env.jwtAudience };
const app = createService("payment");
app.use(publicCors(env.webOrigin, env.adminOrigin));
const stripe = stripeEnabled ? new Stripe(env.stripeSecretKey) : null;

app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    if (!stripe || !env.stripeWebhookSecret) throw new Error("Stripe webhook is not configured");
    const signature = req.header("stripe-signature");
    if (!signature) throw new Error("Missing Stripe-Signature");
    const event = stripe.webhooks.constructEvent(req.body as Buffer, signature, env.stripeWebhookSecret);
    const seen = await prisma.stripeEvent.findUnique({ where: { id: event.id } });
    if (seen) {
      return res.json({ received: true, type: event.type, duplicate: true });
    }
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const orderId = session.metadata?.orderId ?? session.client_reference_id;
      if (orderId) {
        await serviceFetch(env.salesServiceUrl, `/internal/fulfill/${orderId}`, {
          method: "POST",
          internalSecret: env.internalSecret,
        });
      }
    }
    if (event.type === "account.updated") {
      const account = event.data.object;
      await prisma.store.updateMany({
        where: { stripeAccountId: account.id },
        data: { stripeOnboarded: Boolean(account.charges_enabled) },
      });
    }
    try {
      await prisma.stripeEvent.create({ data: { id: event.id, type: event.type } });
    } catch {
      return res.json({ received: true, type: event.type, duplicate: true });
    }
    res.json({ received: true, type: event.type });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Webhook failed" });
  }
});

app.use(express.json());

app.get("/config", (_req, res) => {
  res.json({ stripeEnabled, checkoutMode: stripeEnabled ? "stripe" : "demo" });
});

app.post("/checkout-sessions", requireInternal(env.internalSecret), async (req, res) => {
  if (!stripeEnabled || !stripe) {
    return res.json({ mode: "demo", checkoutUrl: null });
  }
  const stripeAccountId = String(req.body.stripeAccountId ?? "");
  if (!stripeAccountId || !req.body.stripeOnboarded) {
    return res.status(400).json({ error: "This seller has not finished Stripe Connect onboarding yet" });
  }
  const lineItems = Array.isArray(req.body.items) && req.body.items.length > 0
    ? req.body.items
    : [
        {
          quantity: Number(req.body.quantity ?? 1),
          priceCents: Number(req.body.priceCents),
          title: String(req.body.title),
          author: String(req.body.author ?? ""),
        },
      ];
  const cancelUrl = String(req.body.cancelUrl || `${env.webOrigin}/books/${req.body.bookId}`);
  const successUrl = String(req.body.successUrl || `${env.webOrigin}/orders?paid=1`);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: String(req.body.orderId),
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { orderId: String(req.body.orderId) },
    line_items: lineItems.map((item: { quantity?: number; priceCents: number; title: string; author?: string }) => ({
      quantity: Number(item.quantity ?? 1),
      price_data: {
        currency: "usd",
        unit_amount: Number(item.priceCents),
        product_data: { name: String(item.title), description: String(item.author ?? "") },
      },
    })),
    payment_intent_data: {
      application_fee_amount: Number(req.body.fee),
      transfer_data: { destination: stripeAccountId },
    },
  });
  res.json({ mode: "stripe", checkoutUrl: session.url, sessionId: session.id });
});

const auth = requireJwt(jwt);

app.post("/connect", auth, async (req: AuthedRequest, res) => {
  if (!(await requireShopUser(req, res))) return;
  if (!stripeEnabled || !stripe) return res.status(400).json({ error: "Stripe is not configured" });
  const member = await prisma.storeMember.findFirst({
    where: { userId: req.user!.sub, role: "owner" },
  });
  if (!member) return res.status(403).json({ error: "Forbidden" });
  const store = await prisma.store.findUnique({ where: { id: member.storeId } });
  if (!store) return res.status(404).json({ error: "Not found" });
  let accountId = store.stripeAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      metadata: { storeId: store.id },
    });
    accountId = account.id;
    await prisma.store.update({ where: { id: store.id }, data: { stripeAccountId: accountId } });
  }
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${env.webOrigin}/store?stripe=refresh`,
    return_url: `${env.webOrigin}/store?stripe=return`,
  });
  res.json({ url: link.url });
});

app.post("/sync", auth, async (req: AuthedRequest, res) => {
  if (!(await requireShopUser(req, res))) return;
  if (!stripeEnabled || !stripe) return res.status(400).json({ error: "Stripe is not configured" });
  const member = await prisma.storeMember.findFirst({
    where: { userId: req.user!.sub, role: "owner" },
  });
  if (!member) return res.status(403).json({ error: "Forbidden" });
  const store = await prisma.store.findUnique({ where: { id: member.storeId } });
  if (!store?.stripeAccountId) return res.json({ store });
  const account = await stripe.accounts.retrieve(store.stripeAccountId);
  const updated = await prisma.store.update({
    where: { id: store.id },
    data: { stripeOnboarded: Boolean(account.charges_enabled) },
  });
  res.json({ store: updated });
});

app.listen(env.port, () => {
  console.log(`Payment service listening on http://localhost:${env.port}`);
});
