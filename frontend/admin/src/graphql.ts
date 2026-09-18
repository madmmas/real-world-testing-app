import type { BookListItem } from "@rwa/shared";

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
