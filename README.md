# StockPilot

Open-source, self-hosted multi-warehouse inventory management system for retail chains.

## Features

- **Multi-Warehouse** — Track stock across all locations with a real-time products × warehouses matrix
- **Transfer Workflow** — Request → Accept → Ship → Receive with full audit trail
- **PDF Reports** — Packing slips, receiving reports, and sales invoices
- **Role-Based Access** — Admin (full access) and Operator (scoped to assigned warehouse)
- **REST API** — API key authentication, idempotency support, webhook integrations
- **Dark-Mode UI** — Resend/Linear aesthetic, responsive design
- **Self-Hosted** — Your data stays on your server. Docker and Render ready

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| ORM | Prisma 7 |
| Database | PostgreSQL |
| Auth | NextAuth v5 (Credentials + JWT) |
| UI | Tailwind CSS + custom components |
| PDF | @react-pdf/renderer |

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

| Email | Password | Role | Warehouse |
|-------|----------|------|-----------|
| sarah@urbansole.com | password123 | Admin | All |
| demo@demo.com | password123 | Admin | All |
| mike@urbansole.com | password123 | Operator | LA Store |

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

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/products` | List products |
| POST | `/api/v1/products` | Create product (admin) |
| GET | `/api/v1/warehouses` | List warehouses (public) |
| GET | `/api/v1/inventory` | List inventory items |
| POST | `/api/v1/sales` | Record a sale |
| POST | `/api/v1/receive` | Receive stock |
| GET | `/api/v1/transfers` | List transfers |
| POST | `/api/v1/transfers` | Create transfer request |

## License

MIT
