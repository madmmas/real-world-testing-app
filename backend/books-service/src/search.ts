import { prisma } from "@rwa/db";
import { getElasticsearch } from "@rwa/service-kit";
import { listedWhere, toGqlBook, type BookWithStore } from "./catalog.js";
import { elasticsearchSearchEnabled } from "./flags.js";

export const BOOKS_INDEX = "rwa-books";

type SearchArgs = {
  q?: string;
  category?: string;
  isbn?: string;
  author?: string;
  storeSlug?: string;
  limit?: number;
  offset?: number;
};

function bookDocument(book: BookWithStore) {
  return {
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    description: book.description,
    category: book.category,
    status: book.status,
    stock: book.stock,
    priceCents: book.priceCents,
    coverUrl: book.coverUrl,
    storeId: book.storeId,
    storeSlug: book.store.slug,
    storeName: book.store.name,
  };
}

export async function ensureBookIndex() {
  const es = getElasticsearch();
  if (!es) return false;
  try {
    const exists = await es.indices.exists({ index: BOOKS_INDEX });
    if (!exists) {
      await es.indices.create({
        index: BOOKS_INDEX,
        mappings: {
          properties: {
            title: { type: "text", fields: { keyword: { type: "keyword" } } },
            author: { type: "text", fields: { keyword: { type: "keyword" } } },
            isbn: { type: "keyword" },
            description: { type: "text" },
            category: { type: "keyword" },
            status: { type: "keyword" },
            stock: { type: "integer" },
            priceCents: { type: "integer" },
            coverUrl: { type: "keyword", index: false },
            storeId: { type: "keyword" },
            storeSlug: { type: "keyword" },
            storeName: { type: "text" },
          },
        },
      });
    }
    return true;
  } catch {
    return false;
  }
}

export async function indexBook(book: BookWithStore) {
  const ready = await ensureBookIndex();
  if (!ready) return;
  const es = getElasticsearch();
  if (!es) return;
  try {
    await es.index({ index: BOOKS_INDEX, id: book.id, document: bookDocument(book) });
  } catch {
    // Postgres remains source of truth.
  }
}

let syncing = false;

export async function reindexAllBooks() {
  const ready = await ensureBookIndex();
  if (!ready) return 0;
  const es = getElasticsearch();
  if (!es) return 0;
  const books = await prisma.book.findMany({ include: { store: true } });
  for (const book of books) {
    await es.index({ index: BOOKS_INDEX, id: book.id, document: bookDocument(book) });
  }
  try {
    await es.indices.refresh({ index: BOOKS_INDEX });
  } catch {
    // Search can still run; the next refresh will pick the docs up.
  }
  return books.length;
}

/** Copy the Postgres catalog into Elasticsearch when the cluster is up and the index is behind. */
export async function populateBookIndexFromPostgres() {
  if (syncing) return 0;
  const es = getElasticsearch();
  if (!es) return 0;
  syncing = true;
  try {
    await es.ping();
    const ready = await ensureBookIndex();
    if (!ready) return 0;
    const pgCount = await prisma.book.count();
    let esCount = 0;
    try {
      esCount = (await es.count({ index: BOOKS_INDEX })).count;
    } catch {
      esCount = 0;
    }
    if (pgCount === 0 || esCount >= pgCount) return esCount;
    const indexed = await reindexAllBooks();
    if (indexed) console.log(`Indexed ${indexed} books from Postgres into Elasticsearch`);
    return indexed;
  } catch {
    return 0;
  } finally {
    syncing = false;
  }
}

export function startBookIndexSync() {
  if (!getElasticsearch()) return;
  void populateBookIndexFromPostgres();
  setInterval(() => {
    void populateBookIndexFromPostgres();
  }, 15_000);
}

export async function searchBooks(args: SearchArgs) {
  const limit = Math.min(50, Math.max(1, args.limit ?? 20));
  const offset = Math.max(0, args.offset ?? 0);
  let ids: string[] | null = null;
  if (elasticsearchSearchEnabled()) {
    await populateBookIndexFromPostgres();
    ids = await searchBookIds(args, limit, offset);
  }
  if (!ids) {
    const books = await prisma.book.findMany({
      where: listedWhere(args),
      include: { store: true },
      orderBy: { title: "asc" },
      take: limit,
      skip: offset,
    });
    return books.map(toGqlBook);
  }

  if (!ids.length) return [];
  const books = await prisma.book.findMany({
    where: { id: { in: ids }, ...listedWhere({ category: args.category, storeSlug: args.storeSlug }) },
    include: { store: true },
  });
  const byId = new Map(books.map((book) => [book.id, book]));
  return ids.flatMap((id) => {
    const book = byId.get(id);
    return book ? [toGqlBook(book)] : [];
  });
}

async function searchBookIds(args: SearchArgs, limit: number, offset: number) {
  const es = getElasticsearch();
  if (!es) return null;
  const q = args.q?.trim();
  const filter: object[] = [];
  if (args.category) filter.push({ term: { category: args.category } });
  if (args.storeSlug) filter.push({ term: { storeSlug: args.storeSlug } });
  if (args.isbn?.trim()) filter.push({ wildcard: { isbn: `*${args.isbn.trim()}*` } });
  if (args.author?.trim()) {
    filter.push({ match: { author: args.author.trim() } });
  }

  try {
    const result = await es.search({
      index: BOOKS_INDEX,
      from: offset,
      size: limit,
      query: {
        bool: {
          filter,
          must: q
            ? [
                {
                  multi_match: {
                    query: q,
                    fields: ["title^3", "author^2", "isbn^4", "description"],
                    fuzziness: "AUTO",
                  },
                },
              ]
            : [{ match_all: {} }],
        },
      },
    });
    return result.hits.hits.map((hit) => String(hit._id));
  } catch {
    return null;
  }
}
