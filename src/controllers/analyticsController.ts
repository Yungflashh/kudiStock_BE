import { Response } from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order';
import Product from '../models/Product';
import Transaction from '../models/Transaction';
import Supplier from '../models/Supplier';
import { AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import { logger } from '../utils/logger';

export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const storeId = req.params.storeId;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));

    const storeObjectId = mongoose.Types.ObjectId.createFromHexString(storeId);

    const [
      totalProducts, lowStockCount, outOfStockCount,
      totalOrders, todayOrders,
      currentMonthRevenue, lastMonthRevenue,
      totalTransactions,
      pendingOrders, deliveredOrders,
      totalSoldAgg,
    ] = await Promise.all([
      Product.countDocuments({ store: storeId, isActive: true }),
      Product.countDocuments({ store: storeId, isActive: true, $expr: { $lte: ['$quantity', '$lowStockThreshold'] } }),
      Product.countDocuments({ store: storeId, isActive: true, quantity: 0 }),
      Order.countDocuments({ store: storeId }),
      Order.countDocuments({ store: storeId, createdAt: { $gte: startOfToday } }),
      Product.aggregate([
        { $match: { store: storeObjectId, isActive: true, createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$totalRevenue' } } },
      ]),
      Product.aggregate([
        { $match: { store: storeObjectId, isActive: true, createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
        { $group: { _id: null, total: { $sum: '$totalRevenue' } } },
      ]),
      Transaction.countDocuments({ store: storeId }),
      Order.countDocuments({ store: storeId, status: 'pending' }),
      Order.countDocuments({ store: storeId, status: 'delivered' }),
      Product.aggregate([
        { $match: { store: storeObjectId, isActive: true } },
        { $group: { _id: null, total: { $sum: '$totalSold' } } },
      ]),
    ]);

    const currentRevenue = currentMonthRevenue[0]?.total || 0;
    const lastRevenue = lastMonthRevenue[0]?.total || 0;
    const revenueGrowth = lastRevenue > 0 ? ((currentRevenue - lastRevenue) / lastRevenue) * 100 : 0;
    const totalSoldUnits = totalSoldAgg[0]?.total ?? 0;

    successResponse(res, 'Dashboard statistics retrieved successfully.', {
      inventory: { totalProducts, lowStockCount, outOfStockCount, totalSoldUnits },
      orders: { totalOrders, todayOrders, pendingOrders, deliveredOrders },
      revenue: {
        currentMonth: currentRevenue,
        lastMonth: lastRevenue,
        growth: revenueGrowth.toFixed(2),
      },
      transactions: totalTransactions,
    });
  } catch (error: any) {
    logger.error('Dashboard stats error:', error);
    errorResponse(res, 'Failed to retrieve dashboard statistics.', 500);
  }
};

export const getSalesAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const storeId = req.params.storeId;
    const period = (req.query.period as string) || '30';
    const days = Math.min(Math.max(parseInt(period) || 30, 1), 365);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const storeObjectId = mongoose.Types.ObjectId.createFromHexString(storeId);

    const [salesByDay, purchasesByDay, salesByCategory, topProducts, ordersByStatus] = await Promise.all([
      // salesByDay: actual recorded sales (from Transaction model)
      Transaction.aggregate([
        { $match: { store: storeObjectId, category: 'sale', status: 'completed', createdAt: { $gte: startDate } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$amount' },
          orders: { $sum: 1 },
          avgOrder: { $avg: '$amount' },
        }},
        { $sort: { _id: 1 } },
      ]),
      // purchasesByDay: purchase orders placed (from Order model)
      Order.aggregate([
        { $match: { store: storeObjectId, createdAt: { $gte: startDate } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        }},
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        { $match: { store: storeObjectId, createdAt: { $gte: startDate } } },
        { $unwind: '$items' },
        { $lookup: { from: 'products', localField: 'items.product', foreignField: '_id', as: 'productData' } },
        { $unwind: { path: '$productData', preserveNullAndEmptyArrays: true } },
        { $group: {
          _id: '$productData.category',
          revenue: { $sum: '$items.totalPrice' },
          quantity: { $sum: '$items.quantity' },
        }},
        { $sort: { revenue: -1 } },
      ]),
      Product.find({ store: storeId }).sort('-totalSold').limit(5).select('name sku totalSold totalRevenue images'),
      Order.aggregate([
        { $match: { store: storeObjectId, createdAt: { $gte: startDate } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    successResponse(res, 'Sales analytics retrieved successfully.', {
      salesByDay,
      purchasesByDay,
      salesByCategory,
      topProducts,
      ordersByStatus,
      period: days,
    });
  } catch (error: any) {
    logger.error('Sales analytics error:', error);
    errorResponse(res, 'Failed to retrieve sales analytics.', 500);
  }
};

export const getInventoryAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const storeId = req.params.storeId;
    const storeObjectId = mongoose.Types.ObjectId.createFromHexString(storeId);

    const [byCategory, stockValue, movementAnalysis, expiringProducts] = await Promise.all([
      Product.aggregate([
        { $match: { store: storeObjectId, isActive: true } },
        { $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalValue: { $sum: { $multiply: ['$quantity', '$costPrice'] } },
        }},
        { $sort: { totalValue: -1 } },
      ]),
      Product.aggregate([
        { $match: { store: storeObjectId, isActive: true } },
        { $group: {
          _id: null,
          totalCostValue: { $sum: { $multiply: ['$quantity', '$costPrice'] } },
          totalRetailValue: { $sum: { $multiply: ['$quantity', '$sellingPrice'] } },
          totalProducts: { $sum: 1 },
          totalUnits: { $sum: '$quantity' },
        }},
      ]),
      Product.aggregate([
        { $match: { store: storeObjectId, isActive: true } },
        { $project: {
          name: 1, sku: 1, quantity: 1, totalSold: 1,
          turnover: { $cond: [{ $gt: ['$totalSold', 0] }, { $divide: ['$totalSold', { $add: ['$quantity', 1] }] }, 0] },
        }},
        { $sort: { turnover: -1 } },
        { $limit: 20 },
      ]),
      Product.find({
        store: storeId,
        expiryDate: { $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), $gte: new Date() },
        isActive: true,
      }).select('name sku expiryDate quantity'),
    ]);

    successResponse(res, 'Inventory analytics retrieved successfully.', {
      byCategory,
      stockValue: stockValue[0] || {},
      movementAnalysis,
      expiringProducts,
    });
  } catch (error: any) {
    logger.error('Inventory analytics error:', error);
    errorResponse(res, 'Failed to retrieve inventory analytics.', 500);
  }
};

export const getRevenueReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const storeId = req.params.storeId;
    const currentYear = new Date().getFullYear();
    const year = Math.min(Math.max(parseInt((req.query.year as string) || String(currentYear), 10), 2020), currentYear + 1);
    const storeObjectId = mongoose.Types.ObjectId.createFromHexString(storeId);

    const monthlyRevenue = await Order.aggregate([
      {
        $match: {
          store: storeObjectId,
          createdAt: { $gte: new Date(`${year}-01-01T00:00:00.000Z`), $lt: new Date(`${year + 1}-01-01T00:00:00.000Z`) },
        },
      },
      {
        $group: {
          _id: { $month: '$createdAt' },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
          avgOrderValue: { $avg: '$total' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const months = Array.from({ length: 12 }, (_, i) => {
      const found = monthlyRevenue.find(m => m._id === i + 1);
      return {
        month: i + 1,
        monthName: new Date(year, i, 1).toLocaleString('default', { month: 'short' }),
        revenue: found?.revenue || 0,
        orders: found?.orders || 0,
        avgOrderValue: found?.avgOrderValue || 0,
      };
    });

    const totalRevenue = months.reduce((sum, m) => sum + m.revenue, 0);
    const totalOrders = months.reduce((sum, m) => sum + m.orders, 0);

    successResponse(res, 'Revenue report retrieved successfully.', {
      year,
      months,
      summary: { totalRevenue, totalOrders, avgMonthlyRevenue: totalRevenue / 12 },
    });
  } catch (error: any) {
    logger.error('Revenue report error:', error);
    errorResponse(res, 'Failed to retrieve revenue report.', 500);
  }
};
