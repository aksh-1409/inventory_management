# StockPilot

Open-source, self-hosted multi-warehouse inventory management system for retail chains.

> **Live demo:** Deploy your own instance via Docker or Render (see instructions below).

## Features

- **Multi-Warehouse** — Track stock across all locations with a real-time products × warehouses matrix
- **Transfer Workflow** — Request → Accept → Ship → Receive with full audit trail
- **PDF Reports** — Packing slips, receiving reports, and sales invoices
- **Role-Based Access** — Admin (full access) and Operator (scoped to assigned warehouse)
- **REST API** — API key authentication, idempotency support, webhook integrations
- **Dark-Mode UI** — Resend/Linear aesthetic, responsive design
- **Self-Hosted** — Your data stays on your server. Docker and Render ready

## Screenshots

### Public Pages

| Landing Page | Features | Login | Signup |
|:---:|:---:|:---:|:---:|
| ![Landing](docs/screenshots/01-landing-hero.png) | ![Features](docs/screenshots/02-landing-features.png) | ![Login](docs/screenshots/03-login.png) | ![Signup](docs/screenshots/04-signup.png) |
| Hero with "Open Source · Self-Hosted" badge and CTA | Six feature cards: Multi-Warehouse, Transfer Workflow, Dashboard & Reports, Role-Based Access, REST API, Self-Hosted | Quick demo buttons (Sarah Admin, Mike Operator), email/password, Google & GitHub OAuth | Operator registration with warehouse selection |

---

### Admin Dashboard (Sarah — Admin role)

| Dashboard Overview | Stock Matrix | Recent Activity |
|:---:|:---:|:---:|
| ![Dashboard](docs/screenshots/05-admin-dashboard.png) | ![Stock Matrix](docs/screenshots/06-admin-products.png) | ![Recent Activity](docs/screenshots/05-admin-dashboard.png) |
| KPIs: 5 products, 4 warehouses, 0 active transfers, 4 low stock alerts | Products × Warehouses grid with color-coded stock levels (red = critical, yellow = low, green = healthy) | IN/OUT/DAMAGE movement feed with quantity deltas |

---

### Product Management

| Products List | Export Dropdown | Add Product |
|:---:|:---:|:---:|
| ![Products](docs/screenshots/06-admin-products.png) | ![Export](docs/screenshots/12-admin-export-dropdown.png) | ![Add Product](docs/screenshots/13-admin-add-product.png) |
| Inventory matrix with per-warehouse stock, edit/delete actions, search, bulk select | CSV and PDF export options | SKU, Name, Description, Price, Cost, Reorder Point, Category |

| Products Report (PDF) | CSV Export (Excel) |
|:---:|:---:|
| ![PDF Report](docs/screenshots/22-products-report-pdf.png) | ![CSV Export](docs/screenshots/24-csv-export-excel.png) |
| Generated report with Name, SKU, Category, Price, Cost, Reorder | Spreadsheet export opened in Excel |

---

### Warehouse Management

| Warehouses | Add Warehouse |
|:---:|:---:|
| ![Warehouses](docs/screenshots/07-admin-warehouses.png) | ![Add Warehouse](docs/screenshots/07-admin-warehouses.png) |
| Card layout: Chicago Hub, LA Store, Las Vegas, NYC Flagship with stock breakdown per location | "+ Add Warehouse" button opens form for new location |

---

### Transfer Workflow

| Transfers (In Progress) | New Transfer Request |
|:---:|:---:|
| ![Transfers](docs/screenshots/08-admin-transfers.png) | ![New Transfer Request](docs/screenshots/08-admin-transfers.png) |
| Completed transfers with Receiving Report download, tracking numbers | Product, Deliver to, Quantity, Notes |

---

### Inventory Tracking

| Inventory (Admin View) | Color-Coded Status |
|:---:|:---:|
| ![Inventory](docs/screenshots/09-admin-inventory.png) | ![Color-Coded Status](docs/screenshots/09-admin-inventory.png) |
| 15 items across all warehouses — CRITICAL (red), LOW (yellow), HEALTHY (green) status | Adjust button for manual stock corrections |

---

### Sales & Receiving

| Sales List | Record Sale | Receiving |
|:---:|:---:|:---:|
| ![Sales](docs/screenshots/10-admin-sales.png) | ![Record Sale](docs/screenshots/14-admin-record-sale.png) | ![Receiving](docs/screenshots/11-admin-receiving.png) |
| Product, SKU, Warehouse, Qty, Date, Reference, Invoice download | Customer phone auto-lookup, product/warehouse select, quantity & price | 16 received shipments with Receiving Report PDF downloads |

| Receiving Report (PDF) |
|:---:|
| ![Receiving Report](docs/screenshots/23-receiving-report-pdf.png) |
| Purchase order receipt: supplier, shipment details, line items, ordered vs received, damaged write-off |

---

### Customers & Suppliers

| Customers | Suppliers |
|:---:|:---:|
| ![Customers](docs/screenshots/15-admin-customers.png) | ![Suppliers](docs/screenshots/16-admin-suppliers.png) |
| Name, Phone, Email with search and bulk select | Contact cards with email and phone |

---

### User Management & Access Control

| Users | API Keys | Profile |
|:---:|:---:|:---:|
| ![Users](docs/screenshots/17-admin-users.png) | ![API Keys](docs/screenshots/18-admin-api-keys.png) | ![Profile](docs/screenshots/21-admin-profile.png) |
| 14 users, password reset approvals, role/warehouse assignments, admin-only delete | Programmatic access tokens with scoped permissions (products:read, inventory:write, etc.) | Account info, role badge, change password |

---

### Audit Log & Webhooks

| Audit Log | Entity Filter | Action Filter | Webhooks |
|:---:|:---:|:---:|:---:|
| ![Audit Log](docs/screenshots/19-admin-audit-log.png) | ![Entity Filter](docs/screenshots/19-admin-audit-log.png) | ![Action Filter](docs/screenshots/19-admin-audit-log.png) | ![Webhooks](docs/screenshots/20-admin-webhooks.png) |
| Immutable record of all system changes | Filter by Product, Warehouse, Customer, Supplier, WebhookSubscription, ApiKey | CREATE, UPDATE, DELETE, RESTORE | HTTP callbacks on inventory events (e.g., sale.created) |

---

### Operator View (Mike — Operator role, LA Store)

| Login | Dashboard | Products (Read-Only) |
|:---:|:---:|:---:|
| ![Operator Login](docs/screenshots/25-operator-login.png) | ![Operator Dashboard](docs/screenshots/26-operator-dashboard.png) | ![Operator Products](docs/screenshots/27-operator-products.png) |
| Mike (Operator) quick demo selected | Scoped to LA Store: 4 products, 1 warehouse, 0 alerts | Full product list with export only — no Add/Edit/Delete |

| Transfers | Inventory (LA Store Only) | Sales |
|:---:|:---:|:---:|
| ![Operator Transfers](docs/screenshots/28-operator-transfers.png) | ![Operator Inventory](docs/screenshots/29-operator-inventory.png) | ![Operator Sales](docs/screenshots/30-operator-sales.png) |
| New request with "Deliver to: LA Store" pre-filled | 4 items scoped to LA Store, all LOW status | Record sale with customer phone lookup |

| Receiving |
|:---:|
| ![Operator Receiving](docs/screenshots/31-operator-receiving.png) |
| 4 received shipments with Receiving Report PDF downloads |

## Tech Stack

| Layer     | Technology                        |
| --------- | --------------------------------- |
| Framework | Next.js (App Router)              |
| Language  | TypeScript (strict)               |
| ORM       | Prisma                            |
| Database  | PostgreSQL                        |
| Auth      | NextAuth v5 (Credentials + JWT)   |
| UI        | CSS variables + custom components |
| PDF       | @react-pdf/renderer               |

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 14+

### 1. Clone and install

```bash
git clone https://github.com/aksh-1409/inventory_manage.git
cd inventory_manage
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/stockpilot"
NEXTAUTH_SECRET="your-random-secret-here"
NEXTAUTH_URL="http://localhost:3000"
```

Generate a secret:

```bash
openssl rand -base64 32
```

### 3. Set up database

```bash
# Push schema to database
npm run db:push

# Seed with demo data (3 users, 3 warehouses, 4 products)
npx tsx prisma/seed.ts
```

### 4. Start dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Demo Credentials

| Email               | Password | Role     | Warehouse |
| ------------------- | -------- | -------- | --------- |
| sarah@urbansole.com | password123 | Admin    | All       |
| demo@demo.com       | password123 | Admin    | All       |
| mike@urbansole.com  | password123 | Operator | LA Store  |

## Docker

```bash
docker build -t stockpilot .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://postgres:password@host:5432/stockpilot" \
  -e NEXTAUTH_SECRET="your-secret" \
  -e NEXTAUTH_URL="http://localhost:3000" \
  stockpilot
```

## Deploy to Render

1. Fork this repo
2. Create a new PostgreSQL database on Render
3. Create a new Web Service connected to your fork
4. Set environment variables:
   - `DATABASE_URL` — from your Render PostgreSQL
   - `NEXTAUTH_SECRET` — random string
   - `NEXTAUTH_URL` — your Render service URL
5. Build command: `npm run build`
6. Start command: `npm run start`

Or use the included `render.yaml` for automatic setup.

## Project Structure

```
├── app/
│   ├── api/v1/           # REST API routes
│   ├── auth/              # Login & signup pages
│   ├── dashboard/         # Main application pages
│   └── page.tsx           # Landing page
├── components/
│   ├── pdf/               # PDF generation (Transfer, Invoice)
│   └── ui/                # Reusable UI components
├── lib/
│   ├── api-auth.ts        # API key + session auth
│   ├── auth.ts            # NextAuth configuration
│   ├── prisma.ts          # Database client
│   └── webhooks.ts        # Webhook dispatcher
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Demo data seeder
└── Dockerfile             # Multi-stage Docker build
```

## API Usage

### Authentication

All `/api/v1/*` routes support two auth methods:

**Session auth** (browser):

```
Cookie: next-auth.session-token=...
```

**API key auth** (programmatic):

```
Authorization: Bearer sp_live_...
```

Create API keys at `/dashboard/api-keys` (admin only).

### Available Endpoints

| Method | Endpoint             | Description                        |
| ------ | -------------------- | ---------------------------------- |
| GET    | `/api/v1/products`   | List products                      |
| POST   | `/api/v1/products`   | Create product (admin)             |
| GET    | `/api/v1/warehouses` | List warehouses (no auth required) |
| GET    | `/api/v1/inventory`  | List inventory items               |
| POST   | `/api/v1/sales`      | Record a sale                      |
| POST   | `/api/v1/receive`    | Receive stock                      |
| GET    | `/api/v1/transfers`  | List transfers                     |
| POST   | `/api/v1/transfers`  | Create transfer request            |

## License

MIT
