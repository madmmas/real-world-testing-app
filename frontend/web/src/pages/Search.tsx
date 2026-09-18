import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ANALYTICS_EVENTS,
  BOOK_CATEGORIES,
  CATEGORY_LABELS,
  type BookCategory,
  type BookListItem,
} from "@rwa/shared";
import { track } from "@rwa/app-client";
import { BOOK_FIELDS, mapBook, publicGql } from "../graphql";
import { money } from "../money";

export default function Search() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState<BookCategory | "">(
    (params.get("category") as BookCategory) || ""
  );
  const [books, setBooks] = useState<BookListItem[]>([]);
  const [ready, setReady] = useState(false);

  async function load(query: string, cat: BookCategory | "") {
    setReady(false);
    try {
      const data = await publicGql<{ searchBooks: Parameters<typeof mapBook>[0][] }>(
        `
      query Search($q: String, $category: BookCategory) {
        searchBooks(q: $q, category: $category, limit: 40) { ${BOOK_FIELDS} }
      }
    `,
        { q: query || null, category: cat || null }
      );
      setBooks(data.searchBooks.map(mapBook));
      track(ANALYTICS_EVENTS.search, { q: query, category: cat || undefined, results: data.searchBooks.length });
    } catch {
      setBooks([]);
    } finally {
      setReady(true);
    }
  }

  useEffect(() => {
    void load(params.get("q") ?? "", (params.get("category") as BookCategory) || "");
  }, [params]);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (category) next.set("category", category);
    setParams(next);
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Search</h1>
      <form className="mb-6 flex flex-wrap gap-2" onSubmit={onSearch}>
        <input
          className="w-64 rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Title, author, ISBN"
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
        <button className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white" type="submit">
          Search
        </button>
      </form>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {books.map((book) => (
          <Link
            key={book.id}
            to={`/books/${book.id}`}
            className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-100"
          >
            <img src={book.coverUrl} alt={book.title} className="h-48 w-full object-cover bg-slate-100" />
            <div className="p-4">
              <p className="font-semibold">{book.title}</p>
              <p className="text-sm text-slate-500">{book.author}</p>
              <p className="mt-1 text-xs text-slate-500">{CATEGORY_LABELS[book.category]}</p>
              <p className="mt-2 font-medium">{money(book.priceCents)}</p>
            </div>
          </Link>
        ))}
      </div>
      {books.length === 0 && (
        <p className="text-slate-500">{ready ? "No listed books match that search." : "Loading…"}</p>
      )}
    </div>
  );
}
