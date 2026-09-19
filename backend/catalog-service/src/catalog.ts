import type { Book, Store } from "@rwa/db";
import type { BookCategory } from "@rwa/db";
import { BOOK_CATEGORIES } from "@rwa/shared";

export type BookWithStore = Book & { store: Pick<Store, "id" | "name" | "slug" | "stripeOnboarded"> };

export function toGqlBook(book: BookWithStore) {
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
    store: {
      id: book.store.id,
      name: book.store.name,
      slug: book.store.slug,
      stripeOnboarded: book.store.stripeOnboarded,
    },
  };
}

export function toBookItem(book: BookWithStore) {
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
    storeName: book.store.name,
    storeSlug: book.store.slug,
  };
}

export function listedWhere(args: {
  q?: string | null;
  category?: string | null;
  isbn?: string | null;
  author?: string | null;
  storeSlug?: string | null;
}) {
  const query = args.q?.trim();
  return {
    status: "listed" as const,
    stock: { gt: 0 },
    ...(args.category ? { category: args.category as BookCategory } : {}),
    ...(args.storeSlug ? { store: { slug: args.storeSlug } } : {}),
    ...(args.isbn ? { isbn: { contains: args.isbn, mode: "insensitive" as const } } : {}),
    ...(args.author ? { author: { contains: args.author, mode: "insensitive" as const } } : {}),
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" as const } },
            { author: { contains: query, mode: "insensitive" as const } },
            { isbn: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

export { BOOK_CATEGORIES };
