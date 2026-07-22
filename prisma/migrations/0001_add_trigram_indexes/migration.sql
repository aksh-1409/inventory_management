-- Enable pg_trgm extension (requires superuser or appropriate privileges)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Product search columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_sku_trgm ON products USING gin (sku gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_category_trgm ON products USING gin (category gin_trgm_ops) WHERE category IS NOT NULL;

-- Customer search columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_name_trgm ON customers USING gin (name gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_email_trgm ON customers USING gin (email gin_trgm_ops) WHERE email IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_phone_trgm ON customers USING gin (phone gin_trgm_ops);

-- Supplier search columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_suppliers_name_trgm ON suppliers USING gin (name gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_suppliers_contact_name_trgm ON suppliers USING gin (contact_name gin_trgm_ops) WHERE contact_name IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_suppliers_email_trgm ON suppliers USING gin (email gin_trgm_ops) WHERE email IS NOT NULL;

-- Warehouse search columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_warehouses_name_trgm ON warehouses USING gin (name gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_warehouses_location_trgm ON warehouses USING gin (location gin_trgm_ops) WHERE location IS NOT NULL;
