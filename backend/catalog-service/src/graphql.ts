import { GraphQLError } from "graphql";
import { createSchema, createYoga } from "graphql-yoga";
import { type BookCategory, prisma, storeBookCover, writeAudit } from "@rwa/db";
import {
  BOOK_CATEGORIES,
  canAccessAdminSection,
  isPublicRole,
  type JwtPayload,
} from "@rwa/shared";
import { localUiOrigins, serviceFetch, verifyAccessToken } from "@rwa/service-kit";
import { toGqlBook } from "./catalog.js";
import { env } from "./env.js";
import { indexBook, searchBooks } from "./search.js";

type GqlContext = {
  user: JwtPayload | null;
  partnerStoreId: string | null;
};

const jwtEnv = { jwtSecret: env.jwtSecret, jwtIssuer: env.jwtIssuer, jwtAudience: env.jwtAudience };
const bookInclude = { store: true } as const;

async function contextFromRequest(request: Request): Promise<GqlContext> {
  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const apiKey =
    request.headers.get("x-api-key") ?? (bearer?.startsWith("rwa_live_") ? bearer : undefined);

  if (apiKey) {
    try {
      const data = await serviceFetch<{ storeId: string }>(env.storeServiceUrl, "/internal/validate", {
        method: "POST",
        body: JSON.stringify({ key: apiKey }),
        internalSecret: env.internalSecret,
      });
      return { user: null, partnerStoreId: data.storeId };
    } catch {
      throw new GraphQLError("Invalid API key", { extensions: { code: "UNAUTHENTICATED" } });
    }
  }

  if (!bearer) return { user: null, partnerStoreId: null };
  return { user: verifyAccessToken(bearer, jwtEnv), partnerStoreId: null };
}

function denyPartner(ctx: GqlContext) {
  if (ctx.partnerStoreId) {
    throw new GraphQLError("API keys can only search books", { extensions: { code: "FORBIDDEN" } });
  }
}

async function requireShop(ctx: GqlContext) {
  denyPartner(ctx);
  if (!ctx.user) throw new GraphQLError("Unauthorized", { extensions: { code: "UNAUTHENTICATED" } });
  const user = await prisma.user.findUnique({ where: { id: ctx.user.sub } });
  if (!user || !isPublicRole(user.role) || user.role !== "shop") {
    throw new GraphQLError("Shop user role required", { extensions: { code: "FORBIDDEN" } });
  }
  return user;
}

async function requireAdminBooks(ctx: GqlContext) {
  denyPartner(ctx);
  if (!ctx.user) throw new GraphQLError("Unauthorized", { extensions: { code: "UNAUTHENTICATED" } });
  const user = await prisma.user.findUnique({ where: { id: ctx.user.sub } });
  if (!user || !canAccessAdminSection(user.role, "books")) {
    throw new GraphQLError("Forbidden for this admin role", { extensions: { code: "FORBIDDEN" } });
  }
  return user;
}

const schema = /* GraphQL */ `
  enum BookCategory {
    fiction
    mystery
    scifi
    biography
    history
    children
    poetry
    nonfiction
    romance
  }

  type Store {
    id: ID!
    name: String!
    slug: String!
    stripeOnboarded: Boolean!
  }

  type Book {
    id: ID!
    isbn: String!
    title: String!
    author: String!
    description: String!
    coverUrl: String!
    priceCents: Int!
    stock: Int!
    status: String!
    category: BookCategory!
    store: Store!
    storeName: String
  }

  type CategoryShelf {
    category: BookCategory!
    books: [Book!]!
  }

  type Query {
    frontpage: [CategoryShelf!]!
    searchBooks(
      q: String
      category: BookCategory
      isbn: String
      author: String
      storeSlug: String
      limit: Int
      offset: Int
    ): [Book!]!
    book(id: ID!): Book
    myBooks: [Book!]!
    adminBooks(q: String, category: BookCategory): [Book!]!
  }

  type Mutation {
    createBook(
      title: String!
      author: String!
      isbn: String
      description: String
      priceCents: Int!
      stock: Int
      category: BookCategory
    ): Book!
    updateBook(id: ID!, status: String, category: BookCategory): Book!
    adminUpdateBook(id: ID!, status: String, category: BookCategory, priceCents: Int, stock: Int): Book!
  }
`;

export const yoga = createYoga({
  schema: createSchema({
    typeDefs: schema,
    resolvers: {
      Book: {
        storeName: (book: { store?: { name: string }; storeName?: string }) =>
          book.storeName ?? book.store?.name ?? "",
      },
      Query: {
        frontpage: async (_: unknown, __: unknown, ctx: GqlContext) => {
          denyPartner(ctx);
          const shelves = [];
          for (const category of BOOK_CATEGORIES) {
            const books = await prisma.book.findMany({
              where: { status: "listed", stock: { gt: 0 }, category },
              include: bookInclude,
              orderBy: { createdAt: "desc" },
              take: 8,
            });
            if (books.length) shelves.push({ category, books: books.map(toGqlBook) });
          }
          return shelves;
        },
        searchBooks: async (
          _: unknown,
          args: {
            q?: string;
            category?: string;
            isbn?: string;
            author?: string;
            storeSlug?: string;
            limit?: number;
            offset?: number;
          }
        ) => searchBooks(args),
        book: async (_: unknown, args: { id: string }, ctx: GqlContext) => {
          denyPartner(ctx);
          const book = await prisma.book.findUnique({ where: { id: args.id }, include: bookInclude });
          return book ? toGqlBook(book) : null;
        },
        myBooks: async (_: unknown, __: unknown, ctx: GqlContext) => {
          const user = await requireShop(ctx);
          const member = await prisma.storeMember.findFirst({ where: { userId: user.id } });
          if (!member) return [];
          const books = await prisma.book.findMany({
            where: { storeId: member.storeId },
            include: bookInclude,
            orderBy: { createdAt: "desc" },
          });
          return books.map(toGqlBook);
        },
        adminBooks: async (
          _: unknown,
          args: { q?: string; category?: string },
          ctx: GqlContext
        ) => {
          await requireAdminBooks(ctx);
          const q = args.q?.trim() ?? "";
          const books = await prisma.book.findMany({
            where: {
              ...(args.category ? { category: args.category as BookCategory } : {}),
              ...(q
                ? {
                    OR: [
                      { title: { contains: q, mode: "insensitive" } },
                      { author: { contains: q, mode: "insensitive" } },
                      { isbn: { contains: q, mode: "insensitive" } },
                    ],
                  }
                : {}),
            },
            include: bookInclude,
            orderBy: { createdAt: "desc" },
            take: 100,
          });
          return books.map(toGqlBook);
        },
      },
      Mutation: {
        createBook: async (
          _: unknown,
          args: {
            title: string;
            author: string;
            isbn?: string;
            description?: string;
            priceCents: number;
            stock?: number;
            category?: BookCategory;
          },
          ctx: GqlContext
        ) => {
          const user = await requireShop(ctx);
          const title = args.title.trim();
          const author = args.author.trim();
          if (!title || !author) throw new GraphQLError("Title and author are required");
          if (!Number.isFinite(args.priceCents) || args.priceCents < 1) {
            throw new GraphQLError("Price must be at least 1 cent");
          }
          const member = await prisma.storeMember.findFirst({ where: { userId: user.id } });
          if (!member) throw new GraphQLError("Open a store first");
          const stock = Math.max(0, args.stock ?? 1);
          const book = await prisma.book.create({
            data: {
              storeId: member.storeId,
              title,
              author,
              isbn: args.isbn ?? "",
              description: args.description ?? "",
              coverUrl: await storeBookCover(`${title}:${args.isbn ?? ""}:${author}`),
              priceCents: args.priceCents,
              stock,
              status: stock > 0 ? "listed" : "sold_out",
              category: args.category ?? "fiction",
            },
            include: bookInclude,
          });
          await indexBook(book);
          await writeAudit({
            actorId: user.id,
            action: "book.create",
            resource: "book",
            resourceId: book.id,
            meta: { title, storeId: member.storeId },
          });
          return toGqlBook(book);
        },
        updateBook: async (
          _: unknown,
          args: { id: string; status?: string; category?: BookCategory },
          ctx: GqlContext
        ) => {
          const user = await requireShop(ctx);
          const book = await prisma.book.findUnique({ where: { id: args.id } });
          if (!book) throw new GraphQLError("Not found");
          const member = await prisma.storeMember.findUnique({
            where: { storeId_userId: { storeId: book.storeId, userId: user.id } },
          });
          if (!member) throw new GraphQLError("Forbidden", { extensions: { code: "FORBIDDEN" } });
          const updated = await prisma.book.update({
            where: { id: book.id },
            data: {
              status: (args.status as typeof book.status | undefined) ?? book.status,
              category: args.category ?? book.category,
            },
            include: bookInclude,
          });
          await indexBook(updated);
          await writeAudit({
            actorId: user.id,
            action: "book.update",
            resource: "book",
            resourceId: updated.id,
            meta: { status: updated.status, category: updated.category },
          });
          return toGqlBook(updated);
        },
        adminUpdateBook: async (
          _: unknown,
          args: { id: string; status?: string; category?: BookCategory; priceCents?: number; stock?: number },
          ctx: GqlContext
        ) => {
          const actor = await requireAdminBooks(ctx);
          const existing = await prisma.book.findUnique({ where: { id: args.id } });
          if (!existing) throw new GraphQLError("Not found");
          const book = await prisma.book.update({
            where: { id: existing.id },
            data: {
              status: (args.status as typeof existing.status | undefined) ?? existing.status,
              category: args.category ?? existing.category,
              priceCents: args.priceCents ? Math.round(args.priceCents) : existing.priceCents,
              stock: args.stock === undefined ? existing.stock : Math.max(0, args.stock),
            },
            include: bookInclude,
          });
          await indexBook(book);
          await writeAudit({
            actorId: actor.id,
            action: "book.admin_update",
            resource: "book",
            resourceId: book.id,
            meta: { status: book.status, category: book.category },
          });
          return toGqlBook(book);
        },
      },
    },
  }),
  graphqlEndpoint: "/graphql",
  cors: { origin: localUiOrigins(env.webOrigin, env.adminOrigin), credentials: true },
  context: ({ request }) => contextFromRequest(request),
});
