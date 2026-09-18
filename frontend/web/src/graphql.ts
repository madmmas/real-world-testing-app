import type { BookListItem, CategoryShelf } from "@rwa/shared";

export const BOOK_FIELDS = `
  id isbn title author description coverUrl priceCents stock status category
  store { id name slug }
`;

type GqlBook = Omit<BookListItem, "storeId" | "storeName" | "storeSlug"> & {
  store: { id: string; name: string; slug: string };
};

export function mapBook(book: GqlBook): BookListItem {
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
    storeId: book.store.id,
    storeName: book.store.name,
    storeSlug: book.store.slug,
  };
}

export function mapShelf(shelf: { category: BookListItem["category"]; books: GqlBook[] }): CategoryShelf {
  return { category: shelf.category, books: shelf.books.map(mapBook) };
}

export async function publicGql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch("/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) throw new Error(body.errors[0]!.message);
  if (!body.data) throw new Error("GraphQL returned no data");
  return body.data;
}
