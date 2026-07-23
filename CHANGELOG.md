# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-07-23

### Added

- Initial inventory management system with Next.js App Router
- Product, Customer, Supplier, Warehouse CRUD with soft-delete and restore
- Inventory tracking with per-warehouse stock levels
- Sales recording with automatic stock deduction
- Stock receiving and transfer workflows (request → ship → accept → receive)
- User authentication (email/password + OAuth providers) and role-based access (ADMIN/OPERATOR)
- API key authentication with scope-based access control
- Audit log for tracking all mutations across entities
- Pagination (cursor-based for inventory, offset-based for other entities)
- Password reset flow with admin approval for operators
- Idempotency support for sale and receive endpoints
- Webhook dispatch for sale.created and transfer.completed events
- Responsive dashboard layout (320px+ support)
- Export to CSV and PDF for products
- Bulk delete with all-matching support
- Keyboard shortcuts with Command Palette (Cmd/Ctrl+K)
- WCAG 2.1 AA compliance (focus traps, ARIA labels, keyboard navigation)
- Rate limiting on auth routes
- CSRF protection via Web Crypto API
- CI pipeline (format → lint → typecheck → test → e2e)

### Changed

- N/A (initial release)

### Fixed

- N/A (initial release)
