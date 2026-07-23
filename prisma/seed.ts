import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('🌱 Seeding database...');

  // ---- Warehouses ----
  const nycWarehouse = await prisma.warehouse.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'NYC Flagship',
      location: 'New York City, NY',
    },
  });

  const laWarehouse = await prisma.warehouse.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'LA Store',
      location: 'Los Angeles, CA',
    },
  });

  const chicagoWarehouse = await prisma.warehouse.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Chicago Hub',
      location: 'Chicago, IL',
    },
  });

  console.log('✅ Warehouses created: NYC, LA, Chicago');

  // ---- Users ----
  const adminPassword = await bcrypt.hash('password123', 12);
  const operatorPassword = await bcrypt.hash('password123', 12);

  const sarah = await prisma.user.upsert({
    where: { email: 'sarah@urbansole.com' },
    update: {},
    create: {
      name: 'Sarah (Admin)',
      email: 'sarah@urbansole.com',
      passwordHash: adminPassword,
      passwordSetAt: new Date(),
      role: 'ADMIN',
    },
  });

  const mike = await prisma.user.upsert({
    where: { email: 'mike@urbansole.com' },
    update: { warehouseId: laWarehouse.id },
    create: {
      name: 'Mike (Operator)',
      email: 'mike@urbansole.com',
      passwordHash: operatorPassword,
      passwordSetAt: new Date(),
      role: 'OPERATOR',
      warehouseId: laWarehouse.id,
    },
  });

  const demo = await prisma.user.upsert({
    where: { email: 'demo@demo.com' },
    update: {},
    create: {
      name: 'Demo User',
      email: 'demo@demo.com',
      passwordHash: await bcrypt.hash('password123', 12),
      passwordSetAt: new Date(),
      role: 'ADMIN',
    },
  });

  console.log('✅ Users created: Sarah (Admin), Mike (Operator), Demo');

  // ---- Suppliers ----
  const nikeSupplier = await prisma.supplier.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      name: 'Nike Corporation',
      contactName: 'Nike Sales Rep',
      email: 'orders@nike.com',
      phone: '+1-800-344-6453',
    },
  });

  console.log('✅ Suppliers created: Nike');

  // ---- Products ----
  const products = [
    {
      id: '00000000-0000-0000-0000-000000000020',
      sku: 'AM-90-WHT-10',
      name: 'Air Max 90 - White/10',
      description: 'Classic Nike Air Max 90 in white, size 10',
      price: 120.0,
      costPrice: 65.0,
      reorderPoint: 10,
      category: 'Sneakers',
    },
    {
      id: '00000000-0000-0000-0000-000000000021',
      sku: 'AM-270-BLK-9',
      name: 'Air Max 270 - Black/9',
      description: 'Nike Air Max 270 in black, size 9',
      price: 150.0,
      costPrice: 80.0,
      reorderPoint: 8,
      category: 'Sneakers',
    },
    {
      id: '00000000-0000-0000-0000-000000000022',
      sku: 'JF-1-RED-11',
      name: 'Jordan Force 1 - Red/11',
      description: 'Nike Jordan Force 1 in red, size 11',
      price: 180.0,
      costPrice: 95.0,
      reorderPoint: 5,
      category: 'Sneakers',
    },
    {
      id: '00000000-0000-0000-0000-000000000023',
      sku: 'DUNK-GRN-8',
      name: 'Dunk Low - Green/8',
      description: 'Nike Dunk Low in green, size 8',
      price: 110.0,
      costPrice: 55.0,
      reorderPoint: 12,
      category: 'Sneakers',
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {},
      create: {
        id: product.id,
        sku: product.sku,
        name: product.name,
        description: product.description,
        price: product.price,
        costPrice: product.costPrice,
        reorderPoint: product.reorderPoint,
        category: product.category,
      },
    });
  }

  console.log('✅ Products created: Air Max 90, Air Max 270, Jordan Force 1, Dunk Low');

  // ---- Inventory Items (Junction of Reality) ----
  const warehouses = [nycWarehouse, laWarehouse, chicagoWarehouse];
  const inventoryQuantities: Record<string, Record<string, number>> = {
    '00000000-0000-0000-0000-000000000020': {
      // Air Max 90
      '00000000-0000-0000-0000-000000000001': 51, // NYC - healthy
      '00000000-0000-0000-0000-000000000002': 5, // LA  - low (alert)
      '00000000-0000-0000-0000-000000000003': 22, // Chicago
    },
    '00000000-0000-0000-0000-000000000021': {
      // Air Max 270
      '00000000-0000-0000-0000-000000000001': 30,
      '00000000-0000-0000-0000-000000000002': 3, // LA - critical
      '00000000-0000-0000-0000-000000000003': 18,
    },
    '00000000-0000-0000-0000-000000000022': {
      // Jordan Force 1
      '00000000-0000-0000-0000-000000000001': 12,
      '00000000-0000-0000-0000-000000000002': 8,
      '00000000-0000-0000-0000-000000000003': 4, // Chicago - low
    },
    '00000000-0000-0000-0000-000000000023': {
      // Dunk Low
      '00000000-0000-0000-0000-000000000001': 45,
      '00000000-0000-0000-0000-000000000002': 20,
      '00000000-0000-0000-0000-000000000003': 9, // Chicago - below reorder*2 (12*2=24)
    },
  };

  for (const [productId, warehouseQtys] of Object.entries(inventoryQuantities)) {
    for (const [warehouseId, quantity] of Object.entries(warehouseQtys)) {
      const item = await prisma.inventoryItem.upsert({
        where: { productId_warehouseId: { productId, warehouseId } },
        update: { quantity },
        create: { productId, warehouseId, quantity },
      });

      // Seed initial IN transaction for each item
      await prisma.inventoryTransaction.create({
        data: {
          inventoryItemId: item.id,
          type: 'IN',
          delta: quantity,
          reference: 'Initial stock - seed',
          userId: sarah.id,
        },
      });
    }
  }

  console.log('✅ Inventory items and initial transactions seeded');

  // ---- Demo Customer ----
  await prisma.customer.upsert({
    where: { phone: '+1-555-000-0001' },
    update: {},
    create: {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1-555-000-0001',
    },
  });

  console.log('✅ Customer created: John Doe');

  console.log('\n🎉 Seed complete! Demo credentials:');
  console.log('   Admin:    sarah@urbansole.com / password123');
  console.log('   Operator: mike@urbansole.com  / password123');
  console.log('   Demo:     demo@demo.com        / password123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
