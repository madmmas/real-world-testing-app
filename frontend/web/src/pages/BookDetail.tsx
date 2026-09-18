import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ANALYTICS_EVENTS, CATEGORY_LABELS, type BookListItem } from "@rwa/shared";
import { track } from "@rwa/app-client";
import { useAuth } from "../auth";
import { BOOK_FIELDS, mapBook, publicGql } from "../graphql";
import { money } from "../money";

export default function BookDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, apiJson } = useAuth();
  const [book, setBook] = useState<BookListItem | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [buying, setBuying] = useState(false);
  const checkoutKey = useRef(crypto.randomUUID());

  useEffect(() => {
    setReady(false);
    void publicGql<{ book: Parameters<typeof mapBook>[0] | null }>(
      `query Book($id: ID!) { book(id: $id) { ${BOOK_FIELDS} } }`,
      { id }
    )
      .then((data) => {
        const mapped = data.book ? mapBook(data.book) : null;
        setBook(mapped);
        if (mapped) {
          track(ANALYTICS_EVENTS.bookViewed, {
            bookId: mapped.id,
            title: mapped.title,
            category: mapped.category,
            storeId: mapped.storeId,
          });
        }
      })
      .catch(() => setBook(null))
      .finally(() => setReady(true));
  }, [id]);

  async function buy() {
    if (!book) return;
    if (!user) {
      navigate("/signin");
      return;
    }
    setError("");
    setBuying(true);
    try {
      track(ANALYTICS_EVENTS.checkoutStarted, {
        bookId: book.id,
        priceCents: book.priceCents,
        storeId: book.storeId,
      });
      const data = await apiJson<{ checkoutUrl: string | null }>("/checkout", {
        method: "POST",
        headers: { "Idempotency-Key": checkoutKey.current },
        body: JSON.stringify({ bookId: book.id }),
      });
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      navigate("/orders?paid=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBuying(false);
    }
  }

  if (!ready) return <p className="text-slate-500">Loading…</p>;
  if (!book) return <p className="text-slate-500">That book was not found.</p>;

  return (
    <article className="grid gap-8 md:grid-cols-[16rem_1fr]">
      <img src={book.coverUrl} alt={book.title} className="w-full rounded-xl bg-slate-100 object-cover" />
      <div>
        <p className="text-sm text-slate-500">
          {book.storeName} · {CATEGORY_LABELS[book.category]}
        </p>
        <h2 className="mt-1 text-3xl font-semibold">{book.title}</h2>
        <p className="mt-1 text-lg text-slate-600">{book.author}</p>
        {book.isbn && <p className="mt-2 text-sm text-slate-500">ISBN {book.isbn}</p>}
        <p className="mt-4 text-2xl font-bold">{money(book.priceCents)}</p>
        <p className="text-sm text-slate-500">{book.stock} in stock</p>
        <p className="mt-4 text-slate-700">{book.description}</p>
        {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex gap-3">
          <button
            className="rounded-md bg-blue-600 px-5 py-2 font-semibold text-white disabled:opacity-50"
            disabled={buying || book.stock < 1}
            onClick={() => void buy()}
          >
            {buying ? "Working…" : user ? "Buy" : "Sign in to buy"}
          </button>
          <Link className="rounded-md px-4 py-2 text-slate-600 hover:bg-slate-100" to="/">
            Back
          </Link>
        </div>
      </div>
    </article>
  );
}
