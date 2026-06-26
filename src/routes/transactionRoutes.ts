import { Router } from 'express';
import { getTransactions } from '../controllers/miscControllers';
import { authenticate, requireStoreAccess } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate);
router.use(requireStoreAccess);
router.get('/', getTransactions);

export default router;
