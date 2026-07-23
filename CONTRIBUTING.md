# Contributing to StockPilot

## Getting Started

1. Fork the repository.
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/inventory_manage.git
   cd inventory_manage
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Copy the environment file and fill in the values:
   ```bash
   cp .env.example .env
   ```
5. Set up the database:
   ```bash
   npx prisma migrate dev
   npm run seed
   ```

## Development

Start the development server:

```bash
npm run dev
```

### Available Scripts

| Command                | Description               |
| ---------------------- | ------------------------- |
| `npm run dev`          | Start Next.js dev server  |
| `npm run build`        | Production build          |
| `npm run lint`         | Run ESLint                |
| `npm run format`       | Format code with Prettier |
| `npm run format:check` | Check formatting          |
| `npm test`             | Run unit tests            |
| `npm run test:e2e`     | Run Playwright e2e tests  |
| `npm run seed`         | Seed the database         |

## Project Structure

```
├── app/              # Next.js App Router routes
├── components/       # Reusable React components
├── lib/              # Utilities, auth, schemas, types
├── prisma/           # Schema and migrations
├── public/           # Static assets
└── tests/            # Unit and e2e tests
```

## Coding Standards

- **TypeScript** — Strict mode enabled. Avoid `any` and `as any`.
- **Imports** — Use `@/` path alias (e.g. `@/lib/prisma`, `@/components/ui/ConfirmModal`).
- **API routes** — Authenticate with `requireAuth()`, authorize with `hasScope()` and role check.
- **Mutations** — Always call `auditLog()` after creating, updating, or deleting entities.
- **UI** — Use inline styles with CSS variables (`var(--text-heading)`, `var(--border)`, etc.).
- **Accessibility** — All interactive elements must have `aria-label`, focus management, and 44px touch targets.
- **Responsive** — Support 320px minimum width.

## Pull Request Workflow

1. Create a feature branch (`git checkout -b feature/my-feature`).
2. Make your changes.
3. Run verification:
   ```bash
   npm run lint
   npx tsc --noEmit
   npm run format:check
   npm test
   ```
4. Push and open a pull request.
5. Ensure CI passes before requesting review.

## Reporting Issues

Use the [issue templates](.github/ISSUE_TEMPLATE/) for bug reports and feature requests.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
