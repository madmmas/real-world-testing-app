import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BOOK_CATEGORIES, CATEGORY_LABELS, type BookCategory, type BookListItem, type StoreSummary } from "@rwa/shared";
import { useAuth } from "../auth";
import { BOOK_FIELDS, mapBook } from "../graphql";
import { money } from "../money";

export default function Inventory() {
  const { gql, apiJson } = useAuth();
  const [store, setStore] = useState<StoreSummary | null>(null);
  const [ready, setReady] = useState(false);
  const [books, setBooks] = useState<BookListItem[]>([]);
  const [form, setForm] = useState({
    title: "",
    author: "",
    isbn: "",
    description: "",
    price: "19.99",
    stock: "3",
    category: "fiction" as BookCategory,
  });
  const [error, setError] = useState("");

  async function load() {
    try {
      const storeBody = await apiJson<{ store: StoreSummary | null }>("/me/store");
      setStore(storeBody.store);
      if (!storeBody.store) {
        setBooks([]);
        return;
      }
      const data = await gql<{ myBooks: Parameters<typeof mapBook>[0][] }>(`
      query Inventory {
        myBooks { ${BOOK_FIELDS} }
      }
    `);
      setBooks(data.myBooks.map(mapBook));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load inventory");
    } finally {
      setReady(true);
    }
  }

  useEffect(() => {
    void load();
  }, [gql, apiJson]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!store) return;
    setError("");
    try {
      await gql(
        `mutation CreateBook($title: String!, $author: String!, $isbn: String, $description: String, $priceCents: Int!, $stock: Int, $category: BookCategory) {
          createBook(title: $title, author: $author, isbn: $isbn, description: $description, priceCents: $priceCents, stock: $stock, category: $category) { id }
        }`,
        {
          title: form.title,
          author: form.author,
          isbn: form.isbn,
          description: form.description,
          priceCents: Math.round(Number(form.price) * 100),
          stock: Number(form.stock),
          category: form.category,
        }
      );
      setForm({ title: "", author: "", isbn: "", description: "", price: "19.99", stock: "3", category: "fiction" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not list book");
    }
  }

  async function unlist(book: BookListItem) {
    await gql(`mutation UpdateBook($id: ID!, $status: String) { updateBook(id: $id, status: $status) { id } }`, {
      id: book.id,
      status: book.status === "listed" ? "unlisted" : "listed",
    });
    await load();
  }

  if (!ready) return <p className="text-slate-500">Loading…</p>;

  if (!store) {
    if (error) return <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>;
    return (
      <p className="text-slate-600">
        Open a shop first on the <Link className="text-blue-600 underline" to="/store">My store</Link> page.
      </p>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[20rem_1fr]">
      <form className="space-y-3 rounded-xl bg-white p-5 shadow-sm" onSubmit={(e) => void onSubmit(e)}>
        <h2 className="text-lg font-semibold">List a book</h2>
        {error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        {(["title", "author", "isbn", "description"] as const).map((field) => (
          <label key={field} className="block text-sm capitalize">
            {field}
            {field === "description" ? (
              <textarea
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                rows={3}
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              />
            ) : (
              <input
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              />
            )}
          </label>
        ))}
        <label className="block text-sm">
          Category
          <select
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as BookCategory })}
          >
            {BOOK_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {CATEGORY_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Price (USD)
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
        </label>
        <label className="block text-sm">
          Stock
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: e.target.value })}
          />
        </label>
        <button className="w-full rounded-md bg-blue-600 py-2 text-white" type="submit">
          Publish
        </button>
      </form>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Inventory</h2>
        {books.map((book) => (
          <article key={book.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
            <div>
              <p className="font-medium">{book.title}</p>
              <p className="text-sm text-slate-500">
                {book.author} · {CATEGORY_LABELS[book.category]} · {money(book.priceCents)} · {book.stock} in stock · {book.status}
              </p>
            </div>
            <button className="text-sm text-blue-600" onClick={() => void unlist(book)}>
              {book.status === "listed" ? "Unlist" : "List"}
            </button>
          </article>
        ))}
        {books.length === 0 && <p className="text-slate-500">No books yet.</p>}
      </div>
    </div>
  );
}
