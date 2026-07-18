// Shared TypeScript definitions representing the database schema

export type UserRole = 'ADMIN' | 'OPERATOR';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
}

export interface Warehouse {
  id: string;
  name: string;
  location: string | null; // Nullable
  createdAt: Date;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null; // Nullable
  price: number; // Decimal mapped to number in TS
  costPrice: number | null; // Nullable (Flagged: Should be required for financial reporting)
  reorderPoint: number;
  category: string | null; // Nullable
  deletedAt: Date | null; // Nullable (Soft delete)
  createdAt: Date;
  updatedAt: Date;
}

export interface Supplier {
  id: string;
  name: string;
  contactName: string | null; // Nullable
  email: string | null; // Nullable
  phone: string | null; // Nullable
  createdAt: Date;
}

export interface Customer {
  id: string;
  name: string;
  email: string | null; // Nullable
  phone: string;
  createdAt: Date;
}

export interface InventoryItem {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}

export type TransactionType = 'IN' | 'OUT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ADJUSTMENT';

export interface InventoryTransaction {
  id: string;
  inventoryItemId: string;
  type: TransactionType;
  delta: number;
  reference: string | null; // Nullable
  userId: string | null; // Nullable (Flagged: Should be required for complete audit accountability)
  createdAt: Date;
}

export type TransferStatus = 'PENDING' | 'IN_TRANSIT' | 'COMPLETED' | 'PARTIAL' | 'CANCELLED';

export interface Transfer {
  id: string;
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantityInitiated: number;
  quantityReceived: number;
  status: TransferStatus;
  initiatedById: string | null; // Nullable (Flagged: Should be required to verify initiator)
  shippedAt: Date | null; // Nullable
  receivedAt: Date | null; // Nullable
  packingSlipPrintedAt: Date | null; // Nullable
  receivingReportPrintedAt: Date | null; // Nullable
  trackingNumber: string | null; // Nullable
  notes: string | null; // Nullable
  createdAt: Date;
}

export interface ApiKey {
  id: string;
  name: string;
  keyHash: string;
  userId: string;
  scopes: string[];
  lastUsedAt: Date | null; // Nullable
  expiresAt: Date | null; // Nullable
  isActive: boolean;
  createdAt: Date;
}

export interface IdempotencyKey {
  id: string;
  key: string;
  responseStatus: number;
  responseBody: Record<string, any>;
  createdAt: Date;
  expiresAt: Date;
}

export type WebhookEventType = 'stock.low' | 'sale.created' | 'transfer.completed';

export interface WebhookSubscription {
  id: string;
  eventType: WebhookEventType;
  targetUrl: string;
  secret: string | null; // Nullable
  isActive: boolean;
  retryCount: number;
  lastTriggeredAt: Date | null; // Nullable
  createdAt: Date;
}
