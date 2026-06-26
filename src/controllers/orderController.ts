import { Response } from 'express';
import Order from '../models/Order';
import Product from '../models/Product';
import Supplier from '../models/Supplier';
import Store from '../models/Store';
import Transaction from '../models/Transaction';
import { AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response';
import { getPagination, getPaginationMeta } from '../utils/pagination';
import { createNotification } from '../services/notificationService';
import { sendPurchaseOrderEmail } from '../services/emailService';
import { uploadToCloudinary } from '../services/uploadService';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

/**
 * Create a purchase order to a supplier.
 * Does NOT deduct stock — stock is added when the order status is changed to "delivered".
 */
export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const storeId = req.params.storeId;
    // Support both JSON and FormData — when using multer, items comes as a JSON string
    let { supplierId, items, notes, sendEmail } = req.body;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch { items = []; }
    }
    if (typeof sendEmail === 'string') {
      sendEmail = sendEmail === 'true';
    }

    // Upload image if provided
    let uploadedImageUrl: string | undefined;
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, 'orders');
      uploadedImageUrl = result.url;
    }

    // Validate supplier
    const supplier = await Supplier.findOne({ _id: supplierId, store: storeId });
    if (!supplier) {
      errorResponse(res, 'Supplier not found.', 404);
      return;
    }

    // Validate and process items
    const processedItems: any[] = [];
    let subtotal = 0;

    for (const item of items) {
      // If productId is provided, look up the product for name/sku
      if (item.productId) {
        const product = await Product.findOne({ _id: item.productId, store: storeId });
        if (!product) {
          errorResponse(res, `Product not found: ${item.productId}`, 404);
          return;
        }

        const unitPrice = item.unitPrice ?? product.costPrice ?? product.sellingPrice;
        const totalPrice = unitPrice * item.quantity;
        subtotal += totalPrice;

        processedItems.push({
          product: product._id,
          productName: product.name,
          sku: product.sku,
          image: uploadedImageUrl || item.image || (product.images && product.images.length > 0 ? product.images[0] : undefined),
          quantity: item.quantity,
          unitPrice,
          totalPrice,
        });
      } else {
        // Allow ordering items not yet in inventory (new products from supplier)
        const unitPrice = item.unitPrice || 0;
        const totalPrice = unitPrice * item.quantity;
        subtotal += totalPrice;

        processedItems.push({
          productName: item.productName || 'Unknown Item',
          sku: item.sku || '',
          image: uploadedImageUrl || item.image || undefined,
          quantity: item.quantity,
          unitPrice,
          totalPrice,
        });
      }
    }

    const order = await Order.create({
      store: storeId,
      createdBy: req.user._id,
      supplier: supplier._id,
      items: processedItems,
      subtotal,
      total: subtotal,
      notes,
      status: 'pending',
      statusHistory: [{ status: 'pending', changedBy: req.user._id, note: 'Purchase order created' }],
    });

    // Update supplier stats
    await Supplier.findByIdAndUpdate(supplier._id, {
      $inc: { totalOrders: 1 },
    });

    // Send email to supplier if requested and supplier has email
    let emailSent = false;
    if (sendEmail && supplier.email) {
      const store = await Store.findById(storeId);
      const storeName = store?.name || 'Our Store';

      emailSent = await sendPurchaseOrderEmail(
        supplier.email,
        supplier.name,
        storeName,
        order.orderNumber,
        processedItems.map((item: any) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
        subtotal,
        notes
      );

      if (emailSent) {
        order.emailSentToSupplier = true;
        await order.save();
      }
    }

    await createNotification({
      userId: req.user._id.toString(),
      storeId,
      title: '📦 Purchase Order Created',
      message: `Purchase order ${order.orderNumber} for ₦${subtotal.toLocaleString()} sent to ${supplier.name}.`,
      type: 'order',
      metadata: { orderId: order._id },
    });

    const populatedOrder = await Order.findById(order._id)
      .populate('supplier', 'name email phoneNumber companyName')
      .populate('items.product', 'name sku images');

    successResponse(res, 'Purchase order created successfully!', {
      ...populatedOrder?.toObject(),
      emailSent,
    }, 201);
  } catch (error: any) {
    logger.error('Create order error:', error);
    errorResponse(res, error.message || 'Failed to create purchase order.', 500);
  }
};

/**
 * Get orders with filtering and pagination
 */
export const getOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPagination(req);
    const storeId = req.params.storeId;

    const filter: any = { store: storeId };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.supplierId) filter.supplier = req.query.supplierId;
    if (req.query.search) {
      filter.$or = [
        { orderNumber: { $regex: req.query.search, $options: 'i' } },
      ];
    }
    if (req.query.dateFrom || req.query.dateTo) {
      filter.createdAt = {};
      if (req.query.dateFrom) filter.createdAt.$gte = new Date(req.query.dateFrom as string);
      if (req.query.dateTo) filter.createdAt.$lte = new Date(req.query.dateTo as string);
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('supplier', 'name email companyName')
        .populate('createdBy', 'firstName lastName')
        .skip(skip).limit(limit).sort('-createdAt'),
      Order.countDocuments(filter),
    ]);

    paginatedResponse(res, 'Orders retrieved successfully.', orders, getPaginationMeta(total, page, limit));
  } catch (error: any) {
    logger.error('Get orders error:', error);
    errorResponse(res, 'Failed to retrieve orders.', 500);
  }
};

/**
 * Get a single order
 */
export const getOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, store: req.params.storeId })
      .populate('supplier', 'name email phoneNumber companyName address')
      .populate('createdBy', 'firstName lastName email')
      .populate('items.product', 'name sku images');

    if (!order) {
      errorResponse(res, 'Order not found.', 404);
      return;
    }
    successResponse(res, 'Order retrieved successfully.', order);
  } catch (error: any) {
    logger.error('Get order error:', error);
    errorResponse(res, 'Failed to retrieve order.', 500);
  }
};

/**
 * Update order details (items, supplier, notes). Only allowed for pending/sent orders.
 */
export const updateOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const storeId = req.params.storeId;
    const order = await Order.findOne({ _id: req.params.orderId, store: storeId });

    if (!order) {
      errorResponse(res, 'Order not found.', 404);
      return;
    }

    // Only allow editing pending or sent orders
    if (!['pending', 'sent'].includes(order.status)) {
      errorResponse(res, 'Can only edit orders that are pending or sent.', 400);
      return;
    }

    let { supplierId, items, notes } = req.body;
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch { items = undefined; }
    }

    // Upload image if provided
    let uploadedImageUrl: string | undefined;
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, 'orders');
      uploadedImageUrl = result.url;
    }

    // Update supplier if changed
    if (supplierId && supplierId !== String(order.supplier)) {
      const supplier = await Supplier.findOne({ _id: supplierId, store: storeId });
      if (!supplier) {
        errorResponse(res, 'Supplier not found.', 404);
        return;
      }
      order.supplier = supplier._id;
    }

    // Update items if provided
    if (items && Array.isArray(items) && items.length > 0) {
      const processedItems: any[] = [];
      let subtotal = 0;

      for (const item of items) {
        if (item.productId) {
          const product = await Product.findOne({ _id: item.productId, store: storeId });
          if (!product) {
            errorResponse(res, `Product not found: ${item.productId}`, 404);
            return;
          }
          const unitPrice = item.unitPrice ?? product.costPrice ?? product.sellingPrice;
          const totalPrice = unitPrice * item.quantity;
          subtotal += totalPrice;

          processedItems.push({
            product: product._id,
            productName: product.name,
            sku: product.sku,
            image: uploadedImageUrl || item.image || (product.images?.length > 0 ? product.images[0] : undefined),
            quantity: item.quantity,
            unitPrice,
            totalPrice,
          });
        } else {
          const unitPrice = item.unitPrice || 0;
          const totalPrice = unitPrice * item.quantity;
          subtotal += totalPrice;

          processedItems.push({
            productName: item.productName || 'Unknown Item',
            sku: item.sku || '',
            image: uploadedImageUrl || item.image || undefined,
            quantity: item.quantity,
            unitPrice,
            totalPrice,
          });
        }
      }

      order.items = processedItems as any;
      order.subtotal = subtotal;
      order.total = subtotal;
    }

    if (notes !== undefined) order.notes = notes;

    await order.save();

    const populatedOrder = await Order.findById(order._id)
      .populate('supplier', 'name email phoneNumber companyName address')
      .populate('items.product', 'name sku images');

    successResponse(res, 'Order updated successfully.', populatedOrder);
  } catch (error: any) {
    logger.error('Update order error:', error);
    errorResponse(res, error.message || 'Failed to update order.', 500);
  }
};

/**
 * Update order status.
 * When status changes to "delivered", stock is ADDED to the products.
 * When status changes to "cancelled" after delivery, stock is reversed.
 */
export const updateOrderStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const storeId = req.params.storeId;
    const { status, note } = req.body;
    const validStatuses = ['pending', 'sent', 'confirmed', 'in_transit', 'delivered', 'cancelled'];

    if (!validStatuses.includes(status)) {
      await session.abortTransaction();
      errorResponse(res, `Invalid status. Valid statuses: ${validStatuses.join(', ')}`, 400);
      return;
    }

    const order = await Order.findOne({ _id: req.params.orderId, store: storeId }).session(session);
    if (!order) {
      await session.abortTransaction();
      errorResponse(res, 'Order not found.', 404);
      return;
    }

    const previousStatus = order.status;

    // When marking as delivered — ADD stock to existing products, CREATE new products for items not in inventory
    if (status === 'delivered' && previousStatus !== 'delivered') {
      for (const item of order.items) {
        if (item.product) {
          // Existing product — just increase quantity
          await Product.findByIdAndUpdate(
            item.product,
            { $inc: { quantity: item.quantity } },
            { session }
          );
        } else {
          // New product not yet in inventory — create it
          const sku = `SKU-${Date.now()}-${require('crypto').randomBytes(3).toString('hex').toUpperCase()}`;
          const newProduct = await Product.create([{
            store: storeId,
            name: item.productName || 'Unknown Item',
            sku,
            category: 'General',
            costPrice: item.unitPrice || 0,
            sellingPrice: item.unitPrice || 0,
            quantity: item.quantity,
            unit: 'piece',
            supplier: order.supplier,
            images: item.image ? [item.image] : [],
            tags: [],
          }], { session });

          // Link the order item to the newly created product
          item.product = newProduct[0]._id as any;
        }
      }
      order.deliveredAt = new Date();

      // Update supplier totalSpent
      await Supplier.findByIdAndUpdate(
        order.supplier,
        { $inc: { totalSpent: order.total } },
        { session }
      );

      // Record transaction (purchase expense — debit from wallet)
      const store = await Store.findById(storeId).session(session);
      if (store) {
        const balanceBefore = store.walletBalance;
        if (balanceBefore < order.total) {
          logger.warn(`Store ${storeId} wallet going negative: balance ${balanceBefore}, order total ${order.total}`);
        }
        await Transaction.create([{
          store: storeId,
          user: req.user._id,
          type: 'debit',
          category: 'purchase',
          amount: order.total,
          balanceBefore,
          balanceAfter: balanceBefore - order.total,
          description: `Purchase - Order ${order.orderNumber}`,
          order: order._id,
          status: 'completed',
        }], { session });

        await Store.findByIdAndUpdate(storeId, { $inc: { walletBalance: -order.total } }, { session });
      }
    }

    // If cancelling a previously delivered order — reverse the stock
    if (status === 'cancelled' && previousStatus === 'delivered') {
      for (const item of order.items) {
        if (item.product) {
          await Product.findByIdAndUpdate(
            item.product,
            { $inc: { quantity: -item.quantity } },
            { session }
          );
        }
      }
    }

    order.status = status as any;
    order.statusHistory.push({ status, changedBy: req.user._id, changedAt: new Date(), note });
    await order.save({ session });

    await session.commitTransaction();

    await createNotification({
      userId: req.user._id.toString(),
      storeId,
      title: '📦 Order Status Updated',
      message: `Order ${order.orderNumber} status changed to ${status}.`,
      type: 'order',
    });

    successResponse(res, `Order status updated to "${status}" successfully.`, order);
  } catch (error: any) {
    await session.abortTransaction();
    logger.error('Update order status error:', error);
    errorResponse(res, 'Failed to update order status.', 500);
  } finally {
    session.endSession();
  }
};

/**
 * Reorder — create a new purchase order from an existing order (same supplier, same items)
 */
export const reorderFromOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const storeId = req.params.storeId;
    const existingOrder = await Order.findOne({ _id: req.params.orderId, store: storeId });

    if (!existingOrder) {
      errorResponse(res, 'Original order not found.', 404);
      return;
    }

    const supplier = await Supplier.findById(existingOrder.supplier);
    if (!supplier) {
      errorResponse(res, 'Supplier from original order no longer exists.', 404);
      return;
    }

    const { notes, sendEmail } = req.body;

    // Copy items from the existing order
    const newItems = existingOrder.items.map((item) => ({
      product: item.product,
      productName: item.productName,
      sku: item.sku,
      image: item.image,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    }));

    const newOrder = await Order.create({
      store: storeId,
      createdBy: req.user._id,
      supplier: supplier._id,
      items: newItems,
      subtotal: existingOrder.subtotal,
      total: existingOrder.total,
      notes: notes || `Reorder from ${existingOrder.orderNumber}`,
      status: 'pending',
      statusHistory: [{ status: 'pending', changedBy: req.user._id, note: `Reorder from ${existingOrder.orderNumber}` }],
    });

    // Update supplier stats
    await Supplier.findByIdAndUpdate(supplier._id, { $inc: { totalOrders: 1 } });

    // Send email if requested
    let emailSent = false;
    if (sendEmail && supplier.email) {
      const store = await Store.findById(storeId);
      emailSent = await sendPurchaseOrderEmail(
        supplier.email,
        supplier.name,
        store?.name || 'Our Store',
        newOrder.orderNumber,
        newItems.map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
        newOrder.total,
        newOrder.notes
      );
      if (emailSent) {
        newOrder.emailSentToSupplier = true;
        await newOrder.save();
      }
    }

    await createNotification({
      userId: req.user._id.toString(),
      storeId,
      title: '🔄 Reorder Created',
      message: `Reorder ${newOrder.orderNumber} created from ${existingOrder.orderNumber}.`,
      type: 'order',
      metadata: { orderId: newOrder._id },
    });

    const populatedOrder = await Order.findById(newOrder._id)
      .populate('supplier', 'name email phoneNumber companyName')
      .populate('items.product', 'name sku images');

    successResponse(res, 'Reorder created successfully!', {
      ...populatedOrder?.toObject(),
      emailSent,
    }, 201);
  } catch (error: any) {
    logger.error('Reorder error:', error);
    errorResponse(res, error.message || 'Failed to create reorder.', 500);
  }
};

/**
 * Send/resend purchase order email to supplier
 */
export const sendOrderEmail = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, store: req.params.storeId })
      .populate('supplier');

    if (!order) {
      errorResponse(res, 'Order not found.', 404);
      return;
    }

    const supplier = order.supplier as any;
    if (!supplier?.email) {
      errorResponse(res, 'Supplier does not have an email address.', 400);
      return;
    }

    const store = await Store.findById(req.params.storeId);
    const emailSent = await sendPurchaseOrderEmail(
      supplier.email,
      supplier.name,
      store?.name || 'Our Store',
      order.orderNumber,
      order.items.map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
      order.total,
      order.notes
    );

    if (emailSent) {
      order.emailSentToSupplier = true;
      await order.save();
      successResponse(res, 'Purchase order email sent successfully.');
    } else {
      errorResponse(res, 'Failed to send email. Please check SMTP settings.', 500);
    }
  } catch (error: any) {
    logger.error('Send order email error:', error);
    errorResponse(res, 'Failed to send purchase order email.', 500);
  }
};
