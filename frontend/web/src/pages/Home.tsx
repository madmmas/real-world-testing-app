import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CATEGORY_LABELS, type CategoryShelf } from "@rwa/shared";
import { BOOK_FIELDS, mapShelf, publicGql } from "../graphql";
import { money } from "../money";

export default function Home() {
  const [shelves, setShelves] = useState<CategoryShelf[]>([]);
  const [mode, setMode] = useState("demo");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [data, configRes] = await Promise.all([
          publicGql<{ frontpage: Parameters<typeof mapShelf>[0][] }>(`
          query Frontpage {
            frontpage {
              category
              books { ${BOOK_FIELDS} }
            }
          }
        `),
          fetch("/config").catch(() => null),
        ]);
        setShelves(data.frontpage.map(mapShelf));
        if (configRes?.ok) {
          const config = (await configRes.json()) as { checkoutMode?: string };
          setMode(config.checkoutMode ?? "demo");
        }
      } catch {
        setShelves([]);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">Find your next book</h1>
        <p className="mt-1 text-slate-500">Browse listed titles by category from independent stores.</p>
      </div>
      {mode === "demo" && (
        <p className="mb-6 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Stripe is not configured. Checkout records a paid order locally so you can try the flow.
        </p>
      )}
      {!ready && <p className="text-slate-500">Loading…</p>}
      {shelves.map((shelf) => (
        <section key={shelf.category} className="mb-10">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">{CATEGORY_LABELS[shelf.category]}</h2>
            <Link className="text-sm text-blue-600" to={`/search?category=${shelf.category}`}>
              See all
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {shelf.books.map((book) => (
              <Link
                key={book.id}
                to={`/books/${book.id}`}
                className="w-44 shrink-0 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-100"
              >
                <img src={book.coverUrl} alt={book.title} className="h-56 w-full object-cover bg-slate-100" />
                <div className="p-3">
                  <p className="line-clamp-2 text-sm font-semibold">{book.title}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{book.author}</p>
                  <p className="mt-2 text-sm font-medium">{money(book.priceCents)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
      {ready && shelves.length === 0 && <p className="text-slate-500">No listed books yet.</p>}
    </div>
  );
}
