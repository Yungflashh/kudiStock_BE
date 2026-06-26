import { Router } from 'express';
import authRoutes from './authRoutes';
import storeRoutes from './storeRoutes';
import productRoutes from './productRoutes';
import orderRoutes from './orderRoutes';
import analyticsRoutes from './analyticsRoutes';
import supplierRoutes from './supplierRoutes';
import transactionRoutes from './transactionRoutes';
import notificationRoutes from './notificationRoutes';
import aiRoutes from './aiRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/stores', storeRoutes);
router.use('/stores/:storeId/products', productRoutes);
router.use('/stores/:storeId/orders', orderRoutes);
router.use('/stores/:storeId/analytics', analyticsRoutes);
router.use('/stores/:storeId/suppliers', supplierRoutes);
router.use('/stores/:storeId/transactions', transactionRoutes);
router.use('/notifications', notificationRoutes);
router.use('/ai', aiRoutes);

export default router;
