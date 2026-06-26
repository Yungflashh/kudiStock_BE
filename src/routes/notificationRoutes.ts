import { Router } from 'express';
import { getNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification } from '../controllers/miscControllers';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getNotifications);
router.put('/mark-all-read', markAllNotificationsRead);
router.put('/:notificationId/read', markNotificationRead);
router.delete('/:notificationId', deleteNotification);

export default router;
