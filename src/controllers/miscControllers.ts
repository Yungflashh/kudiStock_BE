import { Response } from 'express';
import Supplier from '../models/Supplier';
import Transaction from '../models/Transaction';
import Notification from '../models/Notification';
import { AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response';
import { getPagination, getPaginationMeta } from '../utils/pagination';
import { generateAIInsights, generateProductDescription, getInventoryForecast, chatWithAI } from '../services/aiService';
import { logger } from '../utils/logger';
import Product from '../models/Product';
import Order from '../models/Order';
import Store from '../models/Store';

// ─── Supplier Controllers ──────────────────────────────────────────────────────

export const createSupplier = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, companyName, email, phoneNumber, country, state, city, address, notes } = req.body;
    const supplier = await Supplier.create({ store: req.params.storeId, name, companyName, email, phoneNumber, country, state, city, address, notes });
    successResponse(res, 'Supplier added successfully!', supplier, 201);
  } catch (error: any) {
    logger.error('Create supplier error:', error);
    errorResponse(res, error.message || 'Failed to create supplier.', 500);
  }
};

export const getSuppliers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPagination(req);
    const filter: any = { store: req.params.storeId };
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { companyName: { $regex: req.query.search, $options: 'i' } },
      ];
    }
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

    const [suppliers, total] = await Promise.all([
      Supplier.find(filter).skip(skip).limit(limit).sort('-createdAt'),
      Supplier.countDocuments(filter),
    ]);
    paginatedResponse(res, 'Suppliers retrieved successfully.', suppliers, getPaginationMeta(total, page, limit));
  } catch (error: any) {
    logger.error('Get suppliers error:', error);
    errorResponse(res, 'Failed to retrieve suppliers.', 500);
  }
};

export const getSupplier = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supplier = await Supplier.findOne({ _id: req.params.supplierId, store: req.params.storeId });
    if (!supplier) { errorResponse(res, 'Supplier not found.', 404); return; }
    successResponse(res, 'Supplier retrieved successfully.', supplier);
  } catch (error: any) {
    errorResponse(res, 'Failed to retrieve supplier.', 500);
  }
};

export const updateSupplier = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, companyName, email, phoneNumber, country, state, city, address, notes } = req.body;
    const supplier = await Supplier.findOneAndUpdate(
      { _id: req.params.supplierId, store: req.params.storeId },
      { name, companyName, email, phoneNumber, country, state, city, address, notes },
      { new: true, runValidators: true }
    );
    if (!supplier) { errorResponse(res, 'Supplier not found.', 404); return; }
    successResponse(res, 'Supplier updated successfully.', supplier);
  } catch (error: any) {
    errorResponse(res, 'Failed to update supplier.', 500);
  }
};

export const deleteSupplier = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const supplier = await Supplier.findOneAndDelete({ _id: req.params.supplierId, store: req.params.storeId });
    if (!supplier) { errorResponse(res, 'Supplier not found.', 404); return; }
    successResponse(res, 'Supplier deleted successfully.');
  } catch (error: any) {
    errorResponse(res, 'Failed to delete supplier.', 500);
  }
};

// ─── Transaction Controllers ───────────────────────────────────────────────────

export const getTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPagination(req);
    const filter: any = { store: req.params.storeId };
    if (req.query.type) filter.type = req.query.type;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.dateFrom || req.query.dateTo) {
      filter.createdAt = {};
      if (req.query.dateFrom) filter.createdAt.$gte = new Date(req.query.dateFrom as string);
      if (req.query.dateTo) filter.createdAt.$lte = new Date(req.query.dateTo as string);
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(filter).populate('user', 'firstName lastName').populate('order', 'orderNumber').skip(skip).limit(limit).sort('-createdAt'),
      Transaction.countDocuments(filter),
    ]);
    paginatedResponse(res, 'Transactions retrieved successfully.', transactions, getPaginationMeta(total, page, limit));
  } catch (error: any) {
    errorResponse(res, 'Failed to retrieve transactions.', 500);
  }
};

// ─── Notification Controllers ──────────────────────────────────────────────────

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPagination(req);
    const filter: any = { user: req.user._id };
    if (req.query.isRead !== undefined) filter.isRead = req.query.isRead === 'true';
    if (req.query.storeId) filter.store = req.query.storeId;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).skip(skip).limit(limit).sort('-createdAt'),
      Notification.countDocuments(filter),
      Notification.countDocuments({ user: req.user._id, isRead: false }),
    ]);

    paginatedResponse(res, 'Notifications retrieved successfully.', notifications, {
      ...getPaginationMeta(total, page, limit),
      unreadCount,
    } as any);
  } catch (error: any) {
    errorResponse(res, 'Failed to retrieve notifications.', 500);
  }
};

export const markNotificationRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.notificationId, user: req.user._id },
      { isRead: true }, { new: true }
    );
    if (!notification) { errorResponse(res, 'Notification not found.', 404); return; }
    successResponse(res, 'Notification marked as read.', notification);
  } catch (error: any) {
    errorResponse(res, 'Failed to update notification.', 500);
  }
};

export const markAllNotificationsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
    successResponse(res, `${result.modifiedCount} notification(s) marked as read.`);
  } catch (error: any) {
    errorResponse(res, 'Failed to update notifications.', 500);
  }
};

export const deleteNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.notificationId, user: req.user._id });
    successResponse(res, 'Notification deleted successfully.');
  } catch (error: any) {
    errorResponse(res, 'Failed to delete notification.', 500);
  }
};

// ─── AI Controllers ────────────────────────────────────────────────────────────

export const getAIInsights = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type, question } = req.body;
    const storeId = req.params.storeId;

    let context: any = {};

    if (type === 'inventory') {
      const [products, lowStock, topSelling] = await Promise.all([
        Product.find({ store: storeId, isActive: true }).select('name sku quantity costPrice sellingPrice totalSold category').limit(50),
        Product.find({ store: storeId, isActive: true, $expr: { $lte: ['$quantity', '$lowStockThreshold'] } }).select('name sku quantity lowStockThreshold'),
        Product.find({ store: storeId }).sort('-totalSold').limit(10).select('name totalSold totalRevenue'),
      ]);
      context = { totalProducts: products.length, products: products.slice(0, 20), lowStock, topSelling };
    } else if (type === 'sales') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const mongoose = require('mongoose');
      const [recentOrders, revenue] = await Promise.all([
        Order.find({ store: storeId, createdAt: { $gte: thirtyDaysAgo } }).select('total status createdAt').limit(100),
        Order.aggregate([
          { $match: { store: mongoose.Types.ObjectId.createFromHexString(storeId), createdAt: { $gte: thirtyDaysAgo } } },
          { $group: { _id: null, totalRevenue: { $sum: '$total' }, totalOrders: { $sum: 1 }, avgOrder: { $avg: '$total' } } },
        ]),
      ]);
      context = { recentOrders: recentOrders.length, revenue: revenue[0] || {}, period: '30 days' };
    }

    const language = req.body.language;
    const insights = await generateAIInsights({ type: type || 'general', context, question, language });
    successResponse(res, 'AI insights generated successfully.', { insights, type });
  } catch (error: any) {
    logger.error('AI insights error:', error);
    errorResponse(res, error.message || 'AI service is temporarily unavailable.', 503);
  }
};

export const generateProductDesc = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, category, brand, features, language } = req.body;
    const description = await generateProductDescription({ name, category, brand, features, language });
    successResponse(res, 'Product description generated successfully.', { description });
  } catch (error: any) {
    logger.error('Generate product desc error:', error);
    errorResponse(res, error.message || 'Failed to generate description.', 503);
  }
};

export const getForecast = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const storeId = req.params.storeId;
    const products = await Product.find({ store: storeId, isActive: true })
      .select('name sku quantity totalSold reorderPoint reorderQuantity')
      .sort('-totalSold').limit(20);

    const language = req.body.language;
    const forecast = await getInventoryForecast(products, language);
    successResponse(res, 'Inventory forecast generated successfully.', forecast);
  } catch (error: any) {
    logger.error('AI forecast error:', error);
    errorResponse(res, error.message || 'Failed to generate forecast.', 503);
  }
};

export const aiChat = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { messages, storeId, language } = req.body;

    let storeContext;
    if (storeId) {
      const store = await Store.findById(storeId).select('name category currency settings');
      if (store) storeContext = store.toObject();
    }

    const response = await chatWithAI(messages, storeContext, language);
    successResponse(res, 'AI response generated.', { message: response });
  } catch (error: any) {
    logger.error('AI chat error:', error);
    errorResponse(res, error.message || 'AI assistant is temporarily unavailable.', 503);
  }
};
