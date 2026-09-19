# Visual regression — Admin console (`frontend/admin`, :3004)

Session cookie auth. Mask usernames that Faker generated, timestamps, audit ids, and avatars. Wait for the dark sidebar + main table to paint (no “Loading…”).

Viewports: **1280×800** (sidebar + main) and **375×812** (stacked). Desktop unless named.

## Sign-in and chrome

- **VRT-ADM-01** `/signin`: prefilled `superadmin`, slate primary button, “Superadmin, sales, or marketing session”, no visible captcha (invisible frictionless Altcha).
- **VRT-ADM-02** Buyer credentials on admin sign-in: red error; card layout unchanged.
- **VRT-ADM-02a** After 3 failed passwords: “Interactive bot check” checkbox.
- **VRT-ADM-03** Superadmin shell: slate-900 sidebar with Overview, Users, Stores, Books, Orders, Audit, Logout; `@{username}` + “Superadmin”.
- **VRT-ADM-04** `sales` shell: Users, Stores, Orders present; Books and Audit **absent** from the nav.
- **VRT-ADM-05** `marketing` shell: Books present; Users, Stores, Orders, Audit **absent**.
- **VRT-ADM-06** Mobile 375px superadmin: sidebar stacks above main; Overview still readable.

## Sections

- **VRT-ADM-07** Overview `/`: stats cards (mask counts if they drift; layout and labels stable).
- **VRT-ADM-08** Users `/users`: table + role `<select>` for a `user`/`shop` row.
- **VRT-ADM-09** Stores `/stores`: store name/slug list after seed.
- **VRT-ADM-10** Books `/books`: search/filter bar + book table (mask covers).
- **VRT-ADM-11** Orders `/orders`: seeded paid order row (mask ids/dates).
- **VRT-ADM-12** Audit `/audit` after a role change: at least one row; empty audit if none.

## Stability

- **VRT-ADM-13** Active nav item uses `bg-slate-800 text-white`; other items stay muted. Capture Overview vs Users to lock that contrast.
- **VRT-ADM-14** Same admin page twice: diff only in masked cells (avatars, timestamps).
