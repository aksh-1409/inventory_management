# Architecture

## Tech Stack

- **Framework:** Next.js 15 (App Router)
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
└── PasswordResetRequest

Product ──< InventoryItem >── Warehouse
  │                             │
Customer ──< Sale              │
              │                │
              └── InventoryTransaction

Transfer (REQUESTED → SHIPPED → ACCEPTED → RECEIVED / CANCELLED)
├── Source Warehouse
├── Destination Warehouse
├── Initiated By
└── InventoryTransaction

Supplier ──< Receipt >── Warehouse
```

All core entities (Product, Customer, Supplier, Warehouse) use **soft-delete** via a `deletedAt` timestamp. Queries filter out soft-deleted records by default.

## Auth Flow

```
                    ┌──────────────────┐
                    │   NextAuth v5    │
                    │  (auth.ts/config)│
                    └──────┬───────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
       Credentials     OAuth        API Key
      (email/pw)    (Google/Git)  (Bearer token)
              │            │            │
              └────────────┼────────────┘
                           ▼
                    ┌──────────────┐
                    │  requireAuth │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  hasScope    │
                    │(role/scopes) │
                    └──────┬───────┘
                           ▼
                    Protected Route
```

- **Credentials:** bcrypt password hashing, email verification, password reset via admin approval for operators.
- **OAuth:** Google and GitHub providers with account linking via email.
- **API Keys:** Bearer `sp_live_` tokens with SHA-256 key hashing and scope enforcement.
- **CSRF:** Web Crypto API `crypto.subtle.generateKey()` for token generation (Edge-compatible).
- **Rate Limiting:** In-memory sliding window on auth routes.

## API Design

All data routes live under `/api/v1/`:

| Method | Pattern                        | Auth            | Description                                                      |
| ------ | ------------------------------ | --------------- | ---------------------------------------------------------------- |
| GET    | `/api/v1/{entity}`             | Session/api-key | List with search, pagination, optional export (?export=csv\|pdf) |
| GET    | `/api/v1/{entity}/:id`         | Session/api-key | Single entity                                                    |
| POST   | `/api/v1/{entity}`             | ADMIN           | Create (audit logged)                                            |
| PATCH  | `/api/v1/{entity}/:id`         | ADMIN           | Update (audit logged)                                            |
| DELETE | `/api/v1/{entity}/:id`         | ADMIN           | Soft-delete (audit logged)                                       |
| POST   | `/api/v1/{entity}/:id/restore` | ADMIN           | Restore soft-deleted                                             |
| POST   | `/api/v1/{entity}/bulk-delete` | ADMIN           | Soft-delete multiple                                             |

Pipeline per route:

1. `requireAuth()` — returns `{ user, source }` or 401
2. `hasScope()` + role check — returns 403 if forbidden
3. Zod schema validation — returns 400 if invalid
4. Prisma query
5. `auditLog()` — logs mutation (fire-and-forget, swallows errors)

## Key Design Decisions

- **Soft-delete over hard-delete** — Preserves referential integrity for audit trail and historical data.
- **Fire-and-forget audit logging** — Audit errors never block the primary operation.
- **Cursor pagination for inventory** — Offset pagination for other entities (inventory can be large with frequent writes).
- **Idempotency keys on sales/receives** — Prevents double-recording on network retry via `idempotencyKey` table.
- **Webhook dispatch** — Fire-and-forget on sale and transfer-complete events, with retry table for failures.
- **Component-level CSS** — Inline styles with CSS custom properties (no CSS-in-JS library, no Tailwind).
- **No `src/` directory** — App routes, components, and lib live at project root (supported by Next.js App Router).
