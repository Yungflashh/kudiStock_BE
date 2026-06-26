import { Response } from 'express';
import Product from '../models/Product';
import Transaction from '../models/Transaction';
import { AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response';
import { getPagination, getPaginationMeta } from '../utils/pagination';
import { uploadToCloudinary } from '../services/uploadService';
import { sendLowStockNotification } from '../services/notificationService';
import { logger } from '../utils/logger';

export const createProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const storeId = req.params.storeId;
    const {
      name, sku, barcode, description, category, subCategory, brand,
      costPrice, sellingPrice, quantity, unit, lowStockThreshold,
      reorderPoint, reorderQuantity, supplier, location, expiryDate,
      weight, tags, variants,
    } = req.body;

    // Check for duplicate SKU in same store
    const existing = await Product.findOne({ store: storeId, sku });
    if (existing) {
      errorResponse(res, `SKU "${sku}" already exists in this store. Please use a unique SKU.`, 409);
      return;
    }

    const images: string[] = [];
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files as Express.Multer.File[]) {
        const result = await uploadToCloudinary(file.buffer, 'inventory/products');
        images.push(result.url);
      }
    }

    const product = await Product.create({
      store: storeId,
      name, sku, barcode, description, category, subCategory, brand,
      images, costPrice: parseFloat(costPrice), sellingPrice: parseFloat(sellingPrice),
      quantity: parseInt(quantity || '0'),
      unit: unit || 'piece',
      lowStockThreshold: parseInt(lowStockThreshold || '10'),
      reorderPoint: parseInt(reorderPoint || '5'),
      reorderQuantity: parseInt(reorderQuantity || '50'),
      supplier, location, expiryDate,
      weight: weight ? parseFloat(weight) : undefined,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map((t: string) => t.trim())) : [],
      variants: variants ? (typeof variants === 'string' ? JSON.parse(variants) : variants) : [],
    });

    // Check low stock
    if (product.quantity <= product.lowStockThreshold) {
      await sendLowStockNotification(req.user._id.toString(), storeId, product);
    }

    successResponse(res, 'Product created successfully!', product, 201);
  } catch (error: any) {
    logger.error('Create product error:', error);
    errorResponse(res, error.message || 'Failed to create product.', 500);
  }
};

export const getProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPagination(req);
    const storeId = req.params.storeId;

    const filter: any = { store: storeId };
    if (req.query.search) filter.$text = { $search: req.query.search as string };
    if (req.query.category) filter.category = req.query.category;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    if (req.query.lowStock === 'true') filter.$expr = { $lte: ['$quantity', '$lowStockThreshold'] };

    const sortField = (req.query.sort as string) || '-createdAt';

    const [products, total] = await Promise.all([
      Product.find(filter).populate('supplier', 'name').skip(skip).limit(limit).sort(sortField),
      Product.countDocuments(filter),
    ]);

    paginatedResponse(res, 'Products retrieved successfully.', products, getPaginationMeta(total, page, limit));
  } catch (error: any) {
    logger.error('Get products error:', error);
    errorResponse(res, 'Failed to retrieve products.', 500);
  }
};

export const getProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const product = await Product.findOne({
      _id: req.params.productId,
      store: req.params.storeId,
    }).populate('supplier', 'name email phoneNumber');

    if (!product) {
      errorResponse(res, 'Product not found.', 404);
      return;
    }
    successResponse(res, 'Product retrieved successfully.', product);
  } catch (error: any) {
    logger.error('Get product error:', error);
    errorResponse(res, 'Failed to retrieve product.', 500);
  }
};

export const updateProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowedFields = [
      'name', 'barcode', 'description', 'category', 'subCategory', 'brand',
      'costPrice', 'sellingPrice', 'quantity', 'unit', 'lowStockThreshold',
      'reorderPoint', 'reorderQuantity', 'supplier', 'location', 'expiryDate',
      'weight', 'tags', 'isActive', 'isFeatured', 'variants',
    ];

    const updateData: any = {};
    allowedFields.forEach(f => { if (req.body[f] !== undefined) updateData[f] = req.body[f]; });

    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      const images: string[] = [];
      for (const file of req.files as Express.Multer.File[]) {
        const result = await uploadToCloudinary(file.buffer, 'inventory/products');
        images.push(result.url);
      }
      updateData.$push = { images: { $each: images } };
    }

    const product = await Product.findOneAndUpdate(
      { _id: req.params.productId, store: req.params.storeId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!product) {
      errorResponse(res, 'Product not found.', 404);
      return;
    }

    // Check low stock after update
    if (product.quantity <= product.lowStockThreshold) {
      await sendLowStockNotification(req.user._id.toString(), req.params.storeId, product);
    }

    successResponse(res, 'Product updated successfully.', product);
  } catch (error: any) {
    logger.error('Update product error:', error);
    errorResponse(res, 'Failed to update product.', 500);
  }
};

export const deleteProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const product = await Product.findOneAndDelete({
      _id: req.params.productId,
      store: req.params.storeId,
    });

    if (!product) {
      errorResponse(res, 'Product not found.', 404);
      return;
    }
    successResponse(res, 'Product deleted successfully.');
  } catch (error: any) {
    logger.error('Delete product error:', error);
    errorResponse(res, 'Failed to delete product.', 500);
  }
};

export const adjustStock = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { adjustment, reason } = req.body;
    const adj = parseInt(adjustment);

    const product = await Product.findOne({
      _id: req.params.productId,
      store: req.params.storeId,
    });

    if (!product) {
      errorResponse(res, 'Product not found.', 404);
      return;
    }

    const newQuantity = product.quantity + adj;
    if (newQuantity < 0) {
      errorResponse(res, `Insufficient stock. Current stock: ${product.quantity}, adjustment: ${adj}`, 400);
      return;
    }

    product.quantity = newQuantity;

    // If stock is being reduced (sale), track totalSold, totalRevenue, and create transaction
    if (adj < 0) {
      const unitsSold = Math.abs(adj);
      const saleAmount = unitsSold * (product.sellingPrice || 0);
      product.totalSold = (product.totalSold || 0) + unitsSold;
      product.totalRevenue = (product.totalRevenue || 0) + saleAmount;

      await product.save();

      await Transaction.create({
        store: req.params.storeId,
        user: req.user._id,
        type: 'credit',
        category: 'sale',
        amount: saleAmount,
        balanceBefore: 0,
        balanceAfter: 0,
        description: `Sale: ${unitsSold}x ${product.name}`,
        status: 'completed',
        metadata: { productId: product._id, unitsSold, unitPrice: product.sellingPrice },
      });
    } else {
      await product.save();
    }

    if (newQuantity <= product.lowStockThreshold) {
      await sendLowStockNotification(req.user._id.toString(), req.params.storeId, product);
    }

    successResponse(res, `Stock adjusted by ${adj > 0 ? '+' : ''}${adj}. New quantity: ${newQuantity}`, {
      product,
      adjustment: adj,
      reason,
    });
  } catch (error: any) {
    logger.error('Adjust stock error:', error);
    errorResponse(res, 'Failed to adjust stock.', 500);
  }
};

export const getLowStockProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const products = await Product.find({
      store: req.params.storeId,
      $expr: { $lte: ['$quantity', '$lowStockThreshold'] },
      isActive: true,
    }).sort('quantity').limit(200);

    successResponse(res, `${products.length} low stock product(s) found.`, products);
  } catch (error: any) {
    logger.error('Get low stock error:', error);
    errorResponse(res, 'Failed to retrieve low stock products.', 500);
  }
};

export const getTopSellingProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const products = await Product.find({ store: req.params.storeId, isActive: true })
      .sort('-totalSold')
      .limit(limit)
      .select('name sku images totalSold totalRevenue quantity category sellingPrice costPrice lowStockThreshold');

    successResponse(res, 'Top selling products retrieved successfully.', products);
  } catch (error: any) {
    logger.error('Get top selling error:', error);
    errorResponse(res, 'Failed to retrieve top selling products.', 500);
  }
};
