import { Router } from 'express';
import { body } from 'express-validator';
import { createOrder, getOrders, getOrder, updateOrder, updateOrderStatus, reorderFromOrder, sendOrderEmail } from '../controllers/orderController';
import { authenticate, requireStoreAccess, requireOwnerOrManager } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { upload } from '../services/uploadService';


const router = Router({ mergeParams: true });
router.use(authenticate);
router.use(requireStoreAccess);

// Create a purchase order (with optional image)
router.post('/',
  upload.single('image'),
  [
    body('supplierId').notEmpty().withMessage('Supplier is required').isMongoId().withMessage('Invalid supplier ID'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Item quantity must be at least 1'),
    body('items.*.unitPrice').isFloat({ min: 0 }).withMessage('Item unit price must be 0 or greater'),
  ],
  validate,
  createOrder
);

// Get all orders
router.get('/', getOrders);

// Get single order
router.get('/:orderId', getOrder);

// Update order details (items, supplier, etc.)
router.put('/:orderId', requireOwnerOrManager, upload.single('image'), updateOrder);

// Update order status
router.put('/:orderId/status', requireOwnerOrManager,
  [body('status').notEmpty().withMessage('Status is required')],
  validate,
  updateOrderStatus
);

// Reorder from an existing order
router.post('/:orderId/reorder', reorderFromOrder);

// Send/resend email to supplier
router.post('/:orderId/send-email', sendOrderEmail);

export default router;
