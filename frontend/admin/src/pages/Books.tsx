import { FormEvent, useEffect, useState } from "react";
import { BOOK_CATEGORIES, CATEGORY_LABELS, type BookCategory, type BookListItem } from "@rwa/shared";
import { useAuth } from "../auth";
import { BOOK_FIELDS, mapBook } from "../graphql";
import { money } from "../money";

export default function Books() {
  const { gql } = useAuth();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<BookCategory | "">("");
  const [books, setBooks] = useState<BookListItem[]>([]);

  async function load(query = q, cat = category) {
    const data = await gql<{ adminBooks: Parameters<typeof mapBook>[0][] }>(
      `
      query AdminBooks($q: String, $category: BookCategory) {
        adminBooks(q: $q, category: $category) { ${BOOK_FIELDS} }
      }
    `,
      { q: query || null, category: cat || null }
    );
    setBooks(data.adminBooks.map(mapBook));
  }

  useEffect(() => {
    void load();
  }, [gql]);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    void load();
  }

  async function save(book: BookListItem, patch: { category?: string; status?: string }) {
    await gql(
      `mutation AdminUpdateBook($id: ID!, $status: String, $category: BookCategory) {
        adminUpdateBook(id: $id, status: $status, category: $category) { id }
      }`,
      { id: book.id, ...patch }
    );
    await load();
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Books</h1>
      <form className="mb-4 flex gap-2" onSubmit={onSearch}>
        <input
          className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value as BookCategory | "")}
        >
          <option value="">All categories</option>
          {BOOK_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {CATEGORY_LABELS[item]}
            </option>
          ))}
        </select>
        <button className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white" type="submit">
          Search
        </button>
      </form>
      <div className="space-y-2">
        {books.map((book) => (
          <article key={book.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm">
            <div>
              <p className="font-medium">{book.title}</p>
              <p className="text-sm text-slate-500">
                {book.author} · {book.storeName} · {money(book.priceCents)} · {book.status}
              </p>
            </div>
            <div className="flex gap-2">
              <select
                className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                value={book.category}
                onChange={(e) => void save(book, { category: e.target.value })}
              >
                {BOOK_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {CATEGORY_LABELS[item]}
                  </option>
                ))}
              </select>
              <button
                className="text-sm text-blue-600"
                onClick={() => void save(book, { status: book.status === "listed" ? "unlisted" : "listed" })}
              >
                {book.status === "listed" ? "Unlist" : "List"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
