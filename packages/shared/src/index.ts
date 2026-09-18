export type JwtPayload = {
  sub: string;
  username: string;
  typ: "access";
  jti: string;
};

export const PUBLIC_ROLES = ["user", "shop"] as const;
export const ADMIN_ROLES = ["superadmin", "sales", "marketing"] as const;
export const USER_ROLES = [...PUBLIC_ROLES, ...ADMIN_ROLES] as const;
export const AUTH_PRINCIPALS = ["anonymous", "user", "shop", "api_key"] as const;

export type PublicRole = (typeof PUBLIC_ROLES)[number];
export type AdminRole = (typeof ADMIN_ROLES)[number];
export type UserRole = (typeof USER_ROLES)[number];
export type AuthPrincipal = (typeof AUTH_PRINCIPALS)[number];
export type AdminSection = "stats" | "users" | "stores" | "books" | "orders";

export const ROLE_LABELS: Record<UserRole, string> = {
  user: "Authenticated user",
  shop: "Shop user",
  superadmin: "Superadmin",
  sales: "Sales",
  marketing: "Marketing",
};

const ADMIN_SECTIONS: Record<AdminRole, AdminSection[]> = {
  superadmin: ["stats", "users", "stores", "books", "orders"],
  sales: ["stats", "users", "stores", "orders"],
  marketing: ["stats", "books"],
};

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

export function isPublicRole(value: string): value is PublicRole {
  return (PUBLIC_ROLES as readonly string[]).includes(value);
}

export function isAdminRole(value: string): value is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(value);
}

export function canAccessAdminSection(role: string, section: AdminSection): boolean {
  return isAdminRole(role) && ADMIN_SECTIONS[role].includes(section);
}

export function canAssignRole(actor: string, current: string, next: string): boolean {
  if (!isUserRole(next)) return false;
  if (actor === "superadmin") return true;
  if (actor === "sales") {
    return (current === "user" || current === "shop") && (next === "user" || next === "shop");
  }
  return false;
}

export type PublicUser = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phoneNumber: string;
  avatar: string;
  role: UserRole;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  expiresAt: string;
};

export type TokenErrorCode =
  | "token_expired"
  | "token_invalid"
  | "refresh_token_expired"
  | "refresh_token_reused"
  | "refresh_token_invalid";

export type StoreSummary = {
  id: string;
  name: string;
  slug: string;
  stripeOnboarded: boolean;
};

export const BOOK_CATEGORIES = [
  "fiction",
  "mystery",
  "scifi",
  "biography",
  "history",
  "children",
  "poetry",
  "nonfiction",
  "romance",
] as const;

export type BookCategory = (typeof BOOK_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<BookCategory, string> = {
  fiction: "Fiction",
  mystery: "Mystery",
  scifi: "Science fiction",
  biography: "Biography",
  history: "History",
  children: "Children",
  poetry: "Poetry",
  nonfiction: "Nonfiction",
  romance: "Romance",
};

/** Public-domain Gutenberg covers used as dummy book images (not generic photos). */
const DUMMY_BOOK_COVER_IDS = [
  11, 12, 16, 23, 35, 36, 41, 43, 45, 46, 55, 74, 76, 84, 98, 103, 105, 120, 158, 161, 174, 205, 219,
  345, 514, 768, 844, 996, 1080, 1184, 1232, 1260, 1322, 1342, 1399, 1400, 16328, 1661, 1727, 1952,
  1998, 25344, 2554, 2591, 2600, 2701, 28054, 5200, 6130,
] as const;

export function dummyBookCoverUrl(seed: string) {
  let hash = 0;
  for (const ch of seed) hash = (hash * 33 + ch.charCodeAt(0)) >>> 0;
  const id = DUMMY_BOOK_COVER_IDS[hash % DUMMY_BOOK_COVER_IDS.length]!;
  return `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;
}

export type BookListItem = {
  id: string;
  isbn: string;
  title: string;
  author: string;
  description: string;
  coverUrl: string;
  priceCents: number;
  stock: number;
  status: "listed" | "unlisted" | "sold_out";
  category: BookCategory;
  storeId: string;
  storeName: string;
  storeSlug: string;
};

export type CategoryShelf = {
  category: BookCategory;
  books: BookListItem[];
};

export type OrderListItem = {
  id: string;
  status: string;
  totalCents: number;
  storeName: string;
  createdAt: string;
  title: string;
};

/** Unleash toggle that gates OpenPanel. Env `VITE_OPENPANEL_ENABLED` can override. */
export const FLAG_OPENPANEL = "analytics.openpanel";

/** Unleash toggle that gates Elasticsearch book search. Env `ELASTICSEARCH_SEARCH_ENABLED` can override. */
export const FLAG_ELASTICSEARCH_SEARCH = "search.elasticsearch";

/**
 * Unleash is the default gate. Env can allow or deny the same feature:
 *   true / 1 / yes / on  → on even if the Unleash flag is off
 *   false / 0 / no / off → off even if the Unleash flag is on
 *   unset / empty        → Unleash flag only
 */
export function featureAllowed(envValue: string | undefined, flagOn: boolean): boolean {
  const value = envValue?.trim().toLowerCase();
  if (value === "true" || value === "1" || value === "yes" || value === "on") return true;
  if (value === "false" || value === "0" || value === "no" || value === "off") return false;
  return flagOn;
}

export const ANALYTICS_EVENTS = {
  signupCompleted: "signup_completed",
  login: "login",
  oauthGoogle: "oauth_google",
  search: "search",
  bookViewed: "book_viewed",
  checkoutStarted: "checkout_started",
  checkoutCompleted: "checkout_completed",
} as const;
