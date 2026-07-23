# Architecture

## Tech Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript (strict mode)
- **Database:** PostgreSQL with Prisma ORM
- **Auth:** NextAuth.js v5 with email/password + OAuth (Google, GitHub)
- **UI:** Inline styles using CSS variables with dark theme
- **Testing:** Vitest (unit), Playwright (e2e)
- **Linting:** ESLint + Prettier

## Data Model

```
User (ADMIN / OPERATOR)
├── Warehouse (belongs to)
├── AuditLog (created by)
├── InventoryTransaction (created by)
├── Transfer (initiated/reviewed by)
├── ApiKey (owned by)
├── PasswordResetToken
├── PasswordResetRequest
└── IdempotencyKey

Product ──< InventoryItem >── Warehouse
  │                             │
Customer ──< Sale              │
              │                │
              └── InventoryTransaction

Transfer (REQUESTED ─→ PENDING ─→ IN_TRANSIT ─→ COMPLETED / CANCELLED)
├── Product
├── From Warehouse (source)
├── To Warehouse (destination)
├── Initiated By (user)
└── InventoryTransaction

Supplier ──< Receipt >── Warehouse

IdempotencyKey     (prevents duplicate sales/receives on retry)
WebhookSubscription (event → URL mapping for sale.created, transfer.completed)
AuditLog           (immutable log of all entity mutations)
```

All core entities (Product, Customer, Supplier, Warehouse) use **soft-delete** via a `deletedAt` timestamp. Queries filter out soft-deleted records by default.

## Auth & Authorization

Authentication supports three paths: **credentials** (bcrypt-hashed email/password with email verification and admin-approved password resets for operators), **OAuth** (Google and GitHub with same-email account linking), and **API keys** (Bearer `sp_live_` tokens with SHA-256 key hashing and scope enforcement). All three feed into `requireAuth()` which returns `{ user, source }` or 401. Write operations additionally call `hasScope(user, '<entity>:<action>')`, which grants access if the user is ADMIN, has a session (no scopes array), or holds an API key with the matching scope. Operators are further restricted to their assigned `warehouseId` for sales, receives, and transfer creation — enforced inline in each route handler. ADMIN-only operations (PATCH/DELETE entities, bulk-delete, audit logs, user management) add an explicit `user.role !== 'ADMIN'` check. CSRF protection uses Web Crypto API (Edge-compatible). Rate limiting uses an in-memory sliding window on auth routes.

**Scopes used:** `products:write`, `customers:write`, `suppliers:write`, `warehouses:write`, `sales:write`, `inventory:write`, `transfers:write`, `receive:write`, `api-keys:read`, `api-keys:write`, `webhooks:read`, `webhooks:write`, `admin`, `users:write`.

## API Design

All data routes live under `/api/v1/`. Error responses follow `{ error: string }` with status 400 (validation), 401 (unauthenticated), 403 (forbidden), 404 (not found), 409 (conflict), or 500 (internal).

| Method | Path                             | Auth                       | Description                                                        |
| ------ | -------------------------------- | -------------------------- | ------------------------------------------------------------------ |
| GET    | `/api/v1/products`               | Session/api-key            | List products (search, pagination, ?export=csv\|pdf)               |
| GET    | `/api/v1/products/:id`           | Session/api-key            | Get single product with inventory                                  |
| POST   | `/api/v1/products`               | `products:write` + ADMIN   | Create product                                                     |
| PATCH  | `/api/v1/products/:id`           | `products:write` + ADMIN   | Update product                                                     |
| DELETE | `/api/v1/products/:id`           | `products:write` + ADMIN   | Soft-delete product                                                |
| POST   | `/api/v1/products/:id/restore`   | `products:write`           | Restore soft-deleted product                                       |
| POST   | `/api/v1/products/bulk-delete`   | `products:write` + ADMIN   | Soft-delete multiple products                                      |
| GET    | `/api/v1/customers`              | Session/api-key            | List customers (search, pagination)                                |
| GET    | `/api/v1/customers/:id`          | Session/api-key            | Get single customer                                                |
| POST   | `/api/v1/customers`              | `customers:write`          | Create customer                                                    |
| PATCH  | `/api/v1/customers/:id`          | `customers:write` + ADMIN  | Update customer                                                    |
| DELETE | `/api/v1/customers/:id`          | `customers:write` + ADMIN  | Soft-delete customer                                               |
| POST   | `/api/v1/customers/:id/restore`  | `customers:write`          | Restore soft-deleted customer                                      |
| POST   | `/api/v1/customers/bulk-delete`  | `customers:write` + ADMIN  | Soft-delete multiple customers                                     |
| GET    | `/api/v1/suppliers`              | Session/api-key            | List suppliers (search, pagination)                                |
| GET    | `/api/v1/suppliers/:id`          | Session/api-key            | Get single supplier                                                |
| POST   | `/api/v1/suppliers`              | `suppliers:write`          | Create supplier                                                    |
| PATCH  | `/api/v1/suppliers/:id`          | `suppliers:write` + ADMIN  | Update supplier                                                    |
| DELETE | `/api/v1/suppliers/:id`          | `suppliers:write` + ADMIN  | Soft-delete supplier                                               |
| POST   | `/api/v1/suppliers/:id/restore`  | `suppliers:write`          | Restore soft-deleted supplier                                      |
| POST   | `/api/v1/suppliers/bulk-delete`  | `suppliers:write` + ADMIN  | Soft-delete multiple suppliers                                     |
| GET    | `/api/v1/warehouses`             | None (public)              | List warehouses                                                    |
| GET    | `/api/v1/warehouses/:id`         | Session/api-key            | Get single warehouse                                               |
| POST   | `/api/v1/warehouses`             | `warehouses:write`         | Create warehouse                                                   |
| PATCH  | `/api/v1/warehouses/:id`         | `warehouses:write` + ADMIN | Update warehouse                                                   |
| DELETE | `/api/v1/warehouses/:id`         | `warehouses:write` + ADMIN | Soft-delete warehouse (checks for existing inventory)              |
| POST   | `/api/v1/warehouses/:id/restore` | `warehouses:write`         | Restore soft-deleted warehouse                                     |
| POST   | `/api/v1/warehouses/bulk-delete` | `warehouses:write` + ADMIN | Soft-delete multiple warehouses                                    |
| GET    | `/api/v1/inventory`              | Session/api-key            | List inventory items (cursor + offset pagination)                  |
| POST   | `/api/v1/inventory`              | `inventory:write` + ADMIN  | Adjust stock (atomic with row lock)                                |
| POST   | `/api/v1/sales`                  | `sales:write`              | Record sale (atomic stock decrement, operator scoped to warehouse) |
| POST   | `/api/v1/receive`                | `receive:write`            | Receive stock from supplier (atomic upsert + increment)            |
| GET    | `/api/v1/transfers`              | Session/api-key            | List transfers (operator sees only warehouse-related + REQUESTED)  |
| POST   | `/api/v1/transfers`              | `transfers:write`          | Create transfer REQUEST (operator scoped to destination warehouse) |
| POST   | `/api/v1/transfers/:id/accept`   | `transfers:write`          | Accept → PENDING (assigns source warehouse)                        |
| POST   | `/api/v1/transfers/:id/ship`     | `transfers:write`          | Ship → IN_TRANSIT (source warehouse only)                          |
| POST   | `/api/v1/transfers/:id/receive`  | `transfers:write`          | Receive → COMPLETED (atomic stock transfer)                        |
| GET    | `/api/v1/api-keys`               | `api-keys:read`            | List own API keys                                                  |
| POST   | `/api/v1/api-keys`               | `api-keys:write`           | Create API key                                                     |
| DELETE | `/api/v1/api-keys/:id`           | `api-keys:write`           | Revoke API key                                                     |
| GET    | `/api/v1/audit-logs`             | `admin` scope or ADMIN     | List audit logs (filterable by entity, action, user, date range)   |
| GET    | `/api/v1/webhooks`               | `webhooks:read`            | List webhook subscriptions                                         |
| POST   | `/api/v1/webhooks`               | `webhooks:write`           | Create webhook subscription                                        |
| DELETE | `/api/v1/webhooks/:id`           | `webhooks:write`           | Delete webhook subscription                                        |
| POST   | `/api/v1/webhooks/:id/test`      | `webhooks:write`           | Send test ping                                                     |
| DELETE | `/api/v1/users/:id`              | `users:write` + ADMIN      | Delete operator (cannot self-delete or delete other admins)        |

Pipeline per route:

1. `requireAuth()` — returns `{ user, source }` or 401
2. `hasScope()` + role check — returns 403 if forbidden
3. Zod schema validation — returns 400 with `{ error: string }`
4. Prisma query
5. `auditLog()` — logs mutation (fire-and-forget, swallows errors)
6. On success — returns entity (200/201); on failure — returns `{ error: string }`

### Transfer State Machine

```
REQUESTED ──accept──→ PENDING ──ship──→ IN_TRANSIT ──receive──→ COMPLETED
    │                    │                    │
    └──── CANCELLED ─────┘      PARTIAL (from receive)
```

- `REQUESTED`: No source warehouse assigned. Visible to all admins.
- `PENDING`: Source warehouse assigned (via accept). Awaiting shipment.
- `IN_TRANSIT`: Shipped by source warehouse. Awaiting receipt.
- `COMPLETED`: Received at destination. Stock atomically transferred.
- `CANCELLED`: Cancelled at any point before receipt.
- `PARTIAL`: Partial receipt completed.

## Key Design Decisions

- **Soft-delete over hard-delete** — Preserves referential integrity for audit trail and historical data.
- **Fire-and-forget audit logging** — Audit errors never block the primary operation.
- **Cursor pagination for inventory** — Offset pagination for other entities (inventory can be large with frequent writes).
- **Idempotency keys on sales/receives** — Prevents double-recording on network retry via `idempotencyKey` table.
- **Webhook dispatch** — Fire-and-forget on sale and transfer-complete events, with retry table for failures.
- **Component-level CSS** — Inline styles with CSS custom properties (no CSS-in-JS library, no Tailwind).
- **No `src/` directory** — App routes, components, and lib live at project root (supported by Next.js App Router).
