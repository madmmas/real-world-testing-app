# UI E2E — Admin console (`frontend/admin`, :3004)

Session cookie then JWT for APIs. Routes: `/`, `/users`, `/stores`, `/books`, `/orders`.

- **E2E-ADM-01** `/signin` as `superadmin` / `Passw0rd!` → dashboard; public JWT login is not used.
- **E2E-ADM-02** Buyer credentials on admin sign-in → error.
- **E2E-ADM-03** Unauthenticated `/users` → `/signin`.
- **E2E-ADM-04** Superadmin sees Users, Stores, Books, Orders, stats on dashboard.
- **E2E-ADM-05** `sales` can open Users, Stores, Orders; Books route redirects home.
- **E2E-ADM-06** `marketing` can open Books; Users/Stores/Orders redirect home.
- **E2E-ADM-07** Users: list, change `user` ↔ `shop` as sales; cannot assign admin roles.
- **E2E-ADM-08** Superadmin can assign admin roles as allowed by `canAssignRole`.
- **E2E-ADM-09** Stores list matches GraphQL/REST admin stores.
- **E2E-ADM-10** Books: search/filter, admin update status/price/stock.
- **E2E-ADM-11** Orders list after a demo checkout.
- **E2E-ADM-12** Logout clears session; back-button does not show admin data.
- **E2E-ADM-13** OpenPanel flag same as public site (network only).
