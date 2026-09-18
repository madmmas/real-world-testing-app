import { config } from "dotenv";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import { faker } from "@faker-js/faker";
import { prisma, storeBookCover } from "./index.js";
import { BOOK_CATEGORIES, type UserRole } from "@rwa/shared";

config({ path: resolve(import.meta.dirname, "../../../.env") });

faker.seed(20260917);

const SHOP_COUNT = 6;
const DEMO_PASSWORD = "Passw0rd!";

function hashKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function slugify(name: string, suffix: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "shop"}-${suffix}`;
}

async function createAccount(data: {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  role: UserRole;
  passwordHash: string;
}) {
  return prisma.user.create({
    data: {
      ...data,
      avatar: `https://api.dicebear.com/9.x/pixel-art/svg?seed=${encodeURIComponent(data.username)}`,
    },
  });
}

async function main() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.checkoutIdempotency.deleteMany();
  await prisma.stripeEvent.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.book.deleteMany();
  await prisma.storeMember.deleteMany();
  await prisma.store.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);

  await createAccount({
    firstName: "Site",
    lastName: "Admin",
    username: "superadmin",
    email: "superadmin@example.com",
    role: "superadmin",
    passwordHash,
  });
  await createAccount({
    firstName: "Sam",
    lastName: "Sales",
    username: "sales",
    email: "sales@example.com",
    role: "sales",
    passwordHash,
  });
  await createAccount({
    firstName: "Mia",
    lastName: "Marketing",
    username: "marketing",
    email: "marketing@example.com",
    role: "marketing",
    passwordHash,
  });
  const buyer = await createAccount({
    firstName: "Bailey",
    lastName: "Buyer",
    username: "buyer",
    email: "buyer@example.com",
    role: "user",
    passwordHash,
  });

  const reserved = new Set(["superadmin", "sales", "marketing", "buyer"]);
  const shops = [];

  for (let i = 0; i < SHOP_COUNT; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    let username = faker.internet.username({ firstName, lastName }).replace(/[^a-zA-Z0-9._]/g, "");
    while (!username || reserved.has(username.toLowerCase())) {
      username = `${firstName}${faker.number.int({ min: 10, max: 99 })}`;
    }
    reserved.add(username.toLowerCase());

    const owner = await createAccount({
      firstName,
      lastName,
      username,
      email: faker.internet.email({ firstName, lastName }).toLowerCase(),
      role: "shop",
      passwordHash,
    });

    const shopName = `${faker.word.adjective()} ${faker.helpers.arrayElement(["Books", "Press", "Stacks", "Library", "Folio"])}`;
    const store = await prisma.store.create({
      data: {
        name: shopName,
        slug: slugify(shopName, faker.string.alphanumeric({ length: 4, casing: "lower" })),
        ownerId: owner.id,
        members: { create: { userId: owner.id, role: "owner" } },
      },
    });
    shops.push({ store, owner });

    const bookCount = faker.number.int({ min: 5, max: 8 });
    for (let b = 0; b < bookCount; b++) {
      const title = faker.book.title();
      const isbn = faker.commerce.isbn();
      await prisma.book.create({
        data: {
          storeId: store.id,
          isbn,
          title,
          author: faker.book.author(),
          description: faker.lorem.paragraph(),
          coverUrl: await storeBookCover(`${title}:${isbn}`),
          priceCents: faker.number.int({ min: 899, max: 4999 }),
          stock: faker.number.int({ min: 1, max: 12 }),
          status: "listed",
          category: faker.helpers.arrayElement(BOOK_CATEGORIES),
        },
      });
    }
  }

  const demoStore = shops[0];
  const demoApiKey = `rwa_live_${faker.string.hexadecimal({ length: 32, casing: "lower", prefix: "" })}`;
  if (demoStore) {
    await prisma.apiKey.create({
      data: {
        storeId: demoStore.store.id,
        name: "Partner search (demo)",
        keyPrefix: demoApiKey.slice(0, 12),
        keyHash: hashKey(demoApiKey),
      },
    });

    const seller = shops[1];
    const listed = seller
      ? await prisma.book.findFirst({ where: { storeId: seller.store.id, status: "listed" } })
      : null;
    if (seller && listed) {
      await prisma.order.create({
        data: {
          storeId: seller.store.id,
          buyerId: buyer.id,
          status: "paid",
          totalCents: listed.priceCents,
          platformFeeCents: Math.round(listed.priceCents * 0.1),
          items: {
            create: {
              bookId: listed.id,
              quantity: 1,
              unitPriceCents: listed.priceCents,
            },
          },
        },
      });
    }
  }

  console.log(`Seeded accounts (password: ${DEMO_PASSWORD})`);
  console.log("  superadmin               admin console (all sections)");
  console.log("  sales                    admin console (users, stores, orders)");
  console.log("  marketing                admin console (books)");
  console.log("  buyer                    public authenticated user");
  for (const { store, owner } of shops) {
    console.log(`  ${owner.username.padEnd(24)} shop · ${store.name}`);
  }
  console.log(`Demo partner API key: ${demoApiKey}`);

  const booksUrl = process.env.BOOKS_SERVICE_URL;
  const internalSecret = process.env.INTERNAL_SERVICE_SECRET ?? process.env.JWT_SECRET;
  if (booksUrl && internalSecret) {
    try {
      const res = await fetch(`${booksUrl}/internal/reindex`, {
        method: "POST",
        headers: { "x-internal-secret": internalSecret },
      });
      if (res.ok) {
        const body = (await res.json()) as { indexed?: number };
        console.log(`Reindexed ${body.indexed ?? 0} books into Elasticsearch`);
      }
    } catch {
      // Books service or Elasticsearch may not be running during seed.
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
