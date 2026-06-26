import { Router } from 'express';
import { getDashboardStats, getSalesAnalytics, getInventoryAnalytics, getRevenueReport } from '../controllers/analyticsController';
import { authenticate, requireStoreAccess } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate);
router.use(requireStoreAccess);

router.get('/dashboard', getDashboardStats);
router.get('/sales', getSalesAnalytics);
router.get('/inventory', getInventoryAnalytics);
router.get('/revenue', getRevenueReport);

export default router;
