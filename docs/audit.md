# Audit log

Mutating admin and shop writes append a row to `AuditLog` (no password or API-key plaintext).

| Action | When |
| --- | --- |
| `user.role.change` | Superadmin/sales `PATCH /admin/users/:id` |
| `store.create` | Shop `POST /me/store` |
| `api_key.create` / `api_key.revoke` | Shop key routes |
| `book.create` / `book.update` | Shop GraphQL |
| `book.admin_update` | Admin GraphQL `adminUpdateBook` |

Superadmin UI: https://localhost:3004/audit (`GET /admin/audit`, last 100). Sales and marketing cannot read the log.
