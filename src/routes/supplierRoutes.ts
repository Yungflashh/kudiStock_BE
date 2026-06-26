import { Router } from 'express';
import { body } from 'express-validator';
import { createSupplier, getSuppliers, getSupplier, updateSupplier, deleteSupplier } from '../controllers/miscControllers';
import { authenticate, requireStoreAccess, requireOwnerOrManager } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router({ mergeParams: true });
router.use(authenticate);
router.use(requireStoreAccess);

router.post('/', requireOwnerOrManager,
  [body('name').trim().notEmpty().withMessage('Supplier name is required')],
  validate,
  createSupplier
);
router.get('/', getSuppliers);
router.get('/:supplierId', getSupplier);
router.put('/:supplierId', requireOwnerOrManager, updateSupplier);
router.delete('/:supplierId', requireOwnerOrManager, deleteSupplier);

export default router;
