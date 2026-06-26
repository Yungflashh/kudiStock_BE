import { Router } from 'express';
import { body } from 'express-validator';
import {
  createProduct, getProducts, getProduct, updateProduct, deleteProduct,
  adjustStock, getLowStockProducts, getTopSellingProducts,
} from '../controllers/productController';
import { authenticate, requireStoreAccess, requireOwnerOrManager } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { upload } from '../services/uploadService';

const router = Router({ mergeParams: true });

router.use(authenticate);
router.use(requireStoreAccess);

router.post('/',
  requireOwnerOrManager,
  upload.array('images', 10),
  [
    body('name').trim().notEmpty().withMessage('Product name is required'),
    body('sku').trim().notEmpty().withMessage('SKU is required'),
    body('category').notEmpty().withMessage('Category is required'),
    body('costPrice').isFloat({ min: 0 }).withMessage('Cost price must be a positive number'),
    body('sellingPrice').isFloat({ min: 0 }).withMessage('Selling price must be a positive number'),
  ],
  validate,
  createProduct
);

router.get('/', getProducts);
router.get('/low-stock', getLowStockProducts);
router.get('/top-selling', getTopSellingProducts);
router.get('/:productId', getProduct);

router.put('/:productId', requireOwnerOrManager, upload.array('images', 10), updateProduct);
router.delete('/:productId', requireOwnerOrManager, deleteProduct);

router.post('/:productId/adjust-stock',
  requireOwnerOrManager,
  [
    body('adjustment').isInt().withMessage('Adjustment must be an integer'),
    body('reason').optional().isString(),
  ],
  validate,
  adjustStock
);

export default router;
