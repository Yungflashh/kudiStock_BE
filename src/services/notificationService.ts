import Notification from '../models/Notification';
import User from '../models/User';
import { io } from '../index';
import { logger } from '../utils/logger';
import { sendEmail } from './emailService';
import { sendSMS } from './smsService';

export const createNotification = async (data: {
  userId: string;
  storeId?: string;
  title: string;
  message: string;
  type: 'low_stock' | 'order' | 'payment' | 'system' | 'alert' | 'info' | 'success' | 'warning';
  actionUrl?: string;
  metadata?: Record<string, any>;
}) => {
  try {
    const notification = await Notification.create({
      user: data.userId,
      store: data.storeId,
      title: data.title,
      message: data.message,
      type: data.type,
      actionUrl: data.actionUrl,
      metadata: data.metadata,
    });

    // Emit real-time notification
    io.to(`user-${data.userId}`).emit('notification', notification);
    if (data.storeId) {
      io.to(`store-${data.storeId}`).emit('notification', notification);
    }

    // Send external notifications based on user settings
    const user = await User.findById(data.userId);
    if (user) {
      if (user.notificationSettings.emailNotifications && user.email) {
        await sendEmail({
          to: user.email,
          subject: data.title,
          html: `<p>${data.message}</p>`,
        });
      }
      if (user.notificationSettings.smsNotifications && user.phoneNumber) {
        await sendSMS(user.phoneNumber, `${data.title}: ${data.message}`);
      }
    }

    return notification;
  } catch (error) {
    logger.error('Failed to create notification:', error);
    return null;
  }
};

export const sendLowStockNotification = async (userId: string, storeId: string, product: any) => {
  return createNotification({
    userId,
    storeId,
    title: '⚠️ Low Stock Alert',
    message: `${product.name} (SKU: ${product.sku}) has only ${product.quantity} units left. Reorder point: ${product.reorderPoint}`,
    type: 'low_stock',
    actionUrl: `/stores/${storeId}/products/${product._id}`,
    metadata: { productId: product._id, quantity: product.quantity },
  });
};
