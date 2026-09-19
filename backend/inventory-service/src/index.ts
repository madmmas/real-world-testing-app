import "./env.js";
import express from "express";
import { prisma } from "@rwa/db";
import { inventoryPeekBody, inventoryReleaseBody } from "@rwa/shared/rest";
import { createService, parseBody, publicCors, requireInternal } from "@rwa/service-kit";
import { env } from "./env.js";

const app = createService("inventory");
app.use(publicCors(env.webOrigin, env.adminOrigin));
app.use(express.json());
const internal = requireInternal(env.internalSecret);

async function loadBook(id: string) {
  return prisma.book.findUnique({ where: { id }, include: { store: true } });
}

type BookRow = NonNullable<Awaited<ReturnType<typeof loadBook>>>;

function mapBook(book: BookRow) {
  return {
    id: book.id,
    isbn: book.isbn,
    title: book.title,
    author: book.author,
    description: book.description,
    coverUrl: book.coverUrl,
    priceCents: book.priceCents,
    stock: book.stock,
    status: book.status,
    category: book.category,
    storeId: book.storeId,
    ownerId: book.store.ownerId,
    store: {
      id: book.store.id,
      name: book.store.name,
      slug: book.store.slug,
      stripeOnboarded: book.store.stripeOnboarded,
      stripeAccountId: book.store.stripeAccountId,
    },
  };
}

app.post("/internal/books/:id", internal, async (req, res) => {
  const book = await loadBook(req.params.id);
  if (!book) return res.status(404).json({ error: "Not found" });
  const body = parseBody(inventoryPeekBody, req.body ?? {}, res);
  if (!body) return;
  res.json({ book: mapBook(book) });
});

app.post("/internal/books/:id/reserve", internal, async (req, res) => {
  const existing = await loadBook(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  const body = parseBody(inventoryPeekBody, req.body ?? {}, res);
  if (!body) return;
  const quantity = body.quantity;
  if (!quantity) {
    return res.json({ book: mapBook(existing) });
  }

  const reserved = await prisma.$transaction(async (tx) => {
    const updated = await tx.book.updateMany({
      where: { id: existing.id, status: "listed", stock: { gte: quantity } },
      data: { stock: { decrement: quantity } },
    });
    if (updated.count !== 1) return null;
    const book = await tx.book.findUniqueOrThrow({
      where: { id: existing.id },
      include: { store: true },
    });
    if (book.stock <= 0) {
      return tx.book.update({
        where: { id: book.id },
        data: { stock: 0, status: "sold_out" },
        include: { store: true },
      });
    }
    return book;
  });

  if (!reserved) return res.status(400).json({ error: "Book is not available" });
  res.json({ book: mapBook(reserved) });
});

app.post("/internal/release", internal, async (req, res) => {
  const body = parseBody(inventoryReleaseBody, req.body ?? {}, res);
  if (!body) return;
  for (const item of body.items) {
    try {
      await prisma.$transaction(async (tx) => {
        const book = await tx.book.update({
          where: { id: item.bookId },
          data: { stock: { increment: item.quantity } },
        });
        if (book.status === "sold_out" && book.stock > 0) {
          await tx.book.update({ where: { id: book.id }, data: { status: "listed" } });
        }
      });
    } catch {
      // skip unknown book ids
    }
  }
  res.json({ ok: true });
});

app.listen(env.port, () => {
  console.log(`Inventory service listening on http://localhost:${env.port}`);
});
