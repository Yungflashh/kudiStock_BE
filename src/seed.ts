import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import crypto from 'crypto';
import User from './models/User';
import Store from './models/Store';
import Product from './models/Product';
import Supplier from './models/Supplier';
import Order from './models/Order';
import Transaction from './models/Transaction';
import Notification from './models/Notification';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory_db';

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const randomRef = () => 'TXN-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // ── Wipe existing seed data ──────────────────────────────────────────────
  const existing = await User.findOne({ email: 'user@example.com' });
  if (existing) {
    const store = await Store.findOne({ owner: existing._id });
    if (store) {
      await Promise.all([
        Product.deleteMany({ store: store._id }),
        Supplier.deleteMany({ store: store._id }),
        Order.deleteMany({ store: store._id }),
        Transaction.deleteMany({ store: store._id }),
        Notification.deleteMany({ user: existing._id }),
        Store.deleteOne({ _id: store._id }),
      ]);
    }
    await User.deleteOne({ _id: existing._id });
    console.log('🗑  Cleared previous seed data');
  }

  // ── User ─────────────────────────────────────────────────────────────────
  const user = await User.create({
    firstName: 'Amaka',
    lastName: 'Osei',
    email: 'user@example.com',
    password: 'Password123',
    language: 'en',
    isEmailVerified: true,
    role: 'admin',
  });
  console.log('👤 User created: user@example.com / Password123');

  // ── Store ─────────────────────────────────────────────────────────────────
  const store = await Store.create({
    name: 'Amaka General Stores',
    slug: 'amaka-general-stores-' + Date.now(),
    category: 'Retail/Mini-Mart',
    owner: user._id,
    country: 'Nigeria',
    state: 'Lagos',
    city: 'Ikeja',
    address: '14 Allen Avenue, Ikeja',
    phoneNumber: '+2348012345678',
    email: 'store@example.com',
    currency: 'NGN',
    walletBalance: 850000,
    isVerified: true,
    verificationStatus: 'verified',
  });
  await User.findByIdAndUpdate(user._id, { $push: { stores: store._id } });
  console.log('🏪 Store created: Amaka General Stores');

  // ── Suppliers ─────────────────────────────────────────────────────────────
  const suppliersData = [
    { name: 'Dangote Distributors', companyName: 'Dangote Industries Ltd', email: 'supply@dangote.com', phoneNumber: '+2348023456789', city: 'Lagos', state: 'Lagos', totalOrders: 12, totalSpent: 420000 },
    { name: 'Chukwu Pharma Wholesale', companyName: 'Chukwu Pharmaceuticals', email: 'orders@chukwupharma.ng', phoneNumber: '+2348034567890', city: 'Onitsha', state: 'Anambra', totalOrders: 8, totalSpent: 280000 },
    { name: 'Kano Textiles & Fashion', companyName: 'Northern Fabrics Co.', email: 'sales@kanotextiles.ng', phoneNumber: '+2348045678901', city: 'Kano', state: 'Kano', totalOrders: 6, totalSpent: 195000 },
    { name: 'Lagos Fresh Farms', companyName: 'Fresh Farms Nigeria Ltd', email: 'orders@lagosfresh.ng', phoneNumber: '+2348056789012', city: 'Badagry', state: 'Lagos', totalOrders: 20, totalSpent: 310000 },
    { name: 'Emeka Electronics Hub', companyName: 'Emeka Gadgets & Electronics', email: 'supply@emekaelectronics.ng', phoneNumber: '+2348067890123', city: 'Aba', state: 'Abia', totalOrders: 5, totalSpent: 620000 },
  ];
  const suppliers = await Supplier.insertMany(
    suppliersData.map(s => ({ ...s, store: store._id, isActive: true }))
  );
  console.log(`🤝 ${suppliers.length} suppliers created`);

  // ── Products (25) ─────────────────────────────────────────────────────────
  const categories = ['Food & Beverages', 'Health & Pharmacy', 'Fashion & Clothing', 'Electronics', 'Household', 'Personal Care', 'Stationery'];
  const productsData = [
    // Food & Beverages
    { name: 'Indomie Noodles (Carton)', sku: 'FOOD-001', category: 'Food & Beverages', costPrice: 4200, sellingPrice: 5500, quantity: 80, totalSold: 120, supplier: suppliers[0]._id },
    { name: 'Golden Morn Cereal 500g', sku: 'FOOD-002', category: 'Food & Beverages', costPrice: 1800, sellingPrice: 2400, quantity: 45, totalSold: 63, supplier: suppliers[0]._id },
    { name: 'Peak Milk Tin 400g', sku: 'FOOD-003', category: 'Food & Beverages', costPrice: 2100, sellingPrice: 2800, quantity: 60, totalSold: 95, supplier: suppliers[0]._id },
    { name: 'Dangote Sugar 1kg', sku: 'FOOD-004', category: 'Food & Beverages', costPrice: 1400, sellingPrice: 1800, quantity: 100, totalSold: 210, supplier: suppliers[0]._id },
    { name: 'Milo Chocolate Drink 400g', sku: 'FOOD-005', category: 'Food & Beverages', costPrice: 2600, sellingPrice: 3500, quantity: 35, totalSold: 78, supplier: suppliers[0]._id },
    { name: 'Honeywell Flour 2kg', sku: 'FOOD-006', category: 'Food & Beverages', costPrice: 2900, sellingPrice: 3800, quantity: 55, totalSold: 44, supplier: suppliers[3]._id },
    // Health & Pharmacy
    { name: 'Paracetamol Tablets (Pack)', sku: 'HLTH-001', category: 'Health & Pharmacy', costPrice: 350, sellingPrice: 600, quantity: 200, totalSold: 430, supplier: suppliers[1]._id },
    { name: 'Vitamin C Supplements 60 tabs', sku: 'HLTH-002', category: 'Health & Pharmacy', costPrice: 1200, sellingPrice: 1800, quantity: 85, totalSold: 67, supplier: suppliers[1]._id },
    { name: 'Amoxicillin 250mg (Strip)', sku: 'HLTH-003', category: 'Health & Pharmacy', costPrice: 800, sellingPrice: 1200, quantity: 150, totalSold: 180, supplier: suppliers[1]._id },
    { name: 'Hand Sanitizer 500ml', sku: 'HLTH-004', category: 'Health & Pharmacy', costPrice: 900, sellingPrice: 1400, quantity: 70, totalSold: 95, supplier: suppliers[1]._id },
    // Fashion & Clothing
    { name: 'Ankara Print Fabric (6 yards)', sku: 'FASH-001', category: 'Fashion & Clothing', costPrice: 4500, sellingPrice: 7000, quantity: 30, totalSold: 42, supplier: suppliers[2]._id },
    { name: "Men's Corporate Shirt", sku: 'FASH-002', category: 'Fashion & Clothing', costPrice: 3200, sellingPrice: 5500, quantity: 25, totalSold: 38, supplier: suppliers[2]._id },
    { name: "Women's Lace Blouse", sku: 'FASH-003', category: 'Fashion & Clothing', costPrice: 2800, sellingPrice: 4800, quantity: 20, totalSold: 29, supplier: suppliers[2]._id },
    { name: 'Adire Tie-Dye Fabric (3 yards)', sku: 'FASH-004', category: 'Fashion & Clothing', costPrice: 2200, sellingPrice: 3800, quantity: 40, totalSold: 55, supplier: suppliers[2]._id },
    // Electronics
    { name: 'Power Bank 20000mAh', sku: 'ELEC-001', category: 'Electronics', costPrice: 8500, sellingPrice: 14000, quantity: 15, totalSold: 22, supplier: suppliers[4]._id },
    { name: 'USB-C Charging Cable 2m', sku: 'ELEC-002', category: 'Electronics', costPrice: 900, sellingPrice: 1800, quantity: 120, totalSold: 145, supplier: suppliers[4]._id },
    { name: 'Bluetooth Earbuds (TWS)', sku: 'ELEC-003', category: 'Electronics', costPrice: 6500, sellingPrice: 11000, quantity: 18, totalSold: 27, supplier: suppliers[4]._id },
    { name: 'LED Desk Lamp', sku: 'ELEC-004', category: 'Electronics', costPrice: 3800, sellingPrice: 6500, quantity: 12, totalSold: 16, supplier: suppliers[4]._id },
    // Household
    { name: 'Ariel Detergent 2.5kg', sku: 'HHLD-001', category: 'Household', costPrice: 2800, sellingPrice: 3800, quantity: 65, totalSold: 88, supplier: suppliers[0]._id },
    { name: 'Morning Fresh Dish Soap 750ml', sku: 'HHLD-002', category: 'Household', costPrice: 950, sellingPrice: 1500, quantity: 90, totalSold: 112, supplier: suppliers[0]._id },
    { name: 'Foam Mattress 6x6 (Royal)', sku: 'HHLD-003', category: 'Household', costPrice: 45000, sellingPrice: 65000, quantity: 5, totalSold: 8, supplier: suppliers[0]._id },
    // Personal Care
    { name: 'Dove Body Lotion 400ml', sku: 'CARE-001', category: 'Personal Care', costPrice: 2200, sellingPrice: 3200, quantity: 50, totalSold: 73, supplier: suppliers[1]._id },
    { name: 'Dettol Antiseptic Soap (3 pack)', sku: 'CARE-002', category: 'Personal Care', costPrice: 1400, sellingPrice: 2100, quantity: 80, totalSold: 94, supplier: suppliers[1]._id },
    // Stationery
    { name: 'A4 Printing Paper (Ream)', sku: 'STAT-001', category: 'Stationery', costPrice: 2600, sellingPrice: 3800, quantity: 40, totalSold: 52, supplier: suppliers[0]._id },
    { name: 'Bic Ballpoint Pen (Box of 50)', sku: 'STAT-002', category: 'Stationery', costPrice: 1800, sellingPrice: 3000, quantity: 35, totalSold: 61, supplier: suppliers[0]._id },
  ];

  const products = await Product.insertMany(
    productsData.map(p => ({
      ...p,
      store: store._id,
      unit: 'piece',
      lowStockThreshold: 10,
      reorderPoint: 5,
      reorderQuantity: 50,
      isActive: true,
      totalRevenue: p.totalSold * p.sellingPrice,
    }))
  );
  console.log(`📦 ${products.length} products created`);

  // ── Orders (15) ──────────────────────────────────────────────────────────
  const statuses = ['pending', 'sent', 'confirmed', 'in_transit', 'delivered', 'delivered', 'delivered', 'cancelled'];
  const ordersData = Array.from({ length: 15 }, (_, i) => {
    const supplier = suppliers[i % suppliers.length];
    const product = products[i % products.length];
    const qty = rand(5, 30);
    const unitPrice = product.costPrice;
    const total = qty * unitPrice;
    const status = pick(statuses);
    const createdAt = daysAgo(rand(1, 90));
    return {
      // insertMany skips pre-save hooks, so generate orderNumber manually
      orderNumber: `PO-SEED-${String(i + 1).padStart(3, '0')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      store: store._id,
      createdBy: user._id,
      supplier: supplier._id,
      items: [{
        product: product._id,
        productName: product.name,
        sku: product.sku,
        quantity: qty,
        unitPrice,
        totalPrice: total,
      }],
      subtotal: total,
      total,
      status,
      notes: `Restock order for ${product.name}`,
      statusHistory: [{ status: 'pending', changedBy: user._id, changedAt: createdAt, note: 'Order created' }],
      createdAt,
      updatedAt: createdAt,
    };
  });

  const orders = await Order.insertMany(ordersData);
  console.log(`🛒 ${orders.length} orders created`);

  // ── Sales Transactions (25) ───────────────────────────────────────────────
  let runningBalance = 850000;
  const transactions: any[] = [];

  for (let i = 0; i < 25; i++) {
    const product = products[i % products.length];
    const qty = rand(1, 10);
    const amount = qty * product.sellingPrice;
    const createdAt = daysAgo(rand(1, 60));
    const balanceBefore = runningBalance;
    runningBalance += amount;

    transactions.push({
      store: store._id,
      user: user._id,
      type: 'credit',
      category: 'sale',
      amount,
      balanceBefore,
      balanceAfter: runningBalance,
      reference: randomRef(),
      description: `Sale: ${qty}x ${product.name}`,
      status: 'completed',
      metadata: { productId: product._id, unitsSold: qty, unitPrice: product.sellingPrice },
      createdAt,
      updatedAt: createdAt,
    });
  }

  // Purchase Transactions for delivered orders
  const deliveredOrders = orders.filter(o => o.status === 'delivered');
  for (const order of deliveredOrders) {
    const balanceBefore = runningBalance;
    runningBalance -= order.total;
    transactions.push({
      store: store._id,
      user: user._id,
      type: 'debit',
      category: 'purchase',
      amount: order.total,
      balanceBefore,
      balanceAfter: runningBalance,
      reference: randomRef(),
      description: `Purchase - Order ${order.orderNumber}`,
      order: order._id,
      status: 'completed',
      createdAt: order.createdAt,
      updatedAt: order.createdAt,
    });
  }

  await Transaction.insertMany(transactions);
  console.log(`💳 ${transactions.length} transactions created (${25} sales + ${deliveredOrders.length} purchases)`);

  // Update store wallet to final balance
  await Store.findByIdAndUpdate(store._id, { walletBalance: runningBalance });

  // ── Notifications (10) ───────────────────────────────────────────────────
  const lowStockProducts = products.filter(p => p.quantity <= 20);
  const notificationsData = [
    ...lowStockProducts.slice(0, 4).map(p => ({
      user: user._id,
      store: store._id,
      title: '⚠️ Low Stock Alert',
      message: `${p.name} is running low — only ${p.quantity} units left.`,
      type: 'stock',
      isRead: false,
      createdAt: daysAgo(rand(1, 5)),
    })),
    {
      user: user._id,
      store: store._id,
      title: '📦 Order Delivered',
      message: `Your order from ${suppliers[0].name} has been delivered.`,
      type: 'order',
      isRead: true,
      createdAt: daysAgo(3),
    },
    {
      user: user._id,
      store: store._id,
      title: '📦 Order Delivered',
      message: `Your order from ${suppliers[1].name} has been delivered.`,
      type: 'order',
      isRead: false,
      createdAt: daysAgo(1),
    },
    {
      user: user._id,
      store: store._id,
      title: '💰 Sales Milestone',
      message: 'Congratulations! Your store hit ₦500,000 in total sales this month.',
      type: 'general',
      isRead: false,
      createdAt: daysAgo(2),
    },
    {
      user: user._id,
      store: store._id,
      title: '🎉 Welcome to KudiStocks',
      message: 'Your store is all set up. Start adding products and tracking your inventory.',
      type: 'general',
      isRead: true,
      createdAt: daysAgo(30),
    },
  ];

  await Notification.insertMany(notificationsData);
  console.log(`🔔 ${notificationsData.length} notifications created`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Seed complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📧 Email:    user@example.com');
  console.log('🔑 Password: Password123');
  console.log(`🏪 Store:    Amaka General Stores (Lagos)`);
  console.log(`📦 Products: ${products.length}`);
  console.log(`🤝 Suppliers: ${suppliers.length}`);
  console.log(`🛒 Orders:   ${orders.length}`);
  console.log(`💳 Transactions: ${transactions.length}`);
  console.log(`💰 Wallet Balance: ₦${runningBalance.toLocaleString()}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  mongoose.disconnect();
  process.exit(1);
});
