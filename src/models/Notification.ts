import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  store?: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: 'low_stock' | 'order' | 'payment' | 'system' | 'alert' | 'info' | 'success' | 'warning';
  isRead: boolean;
  actionUrl?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    store: { type: Schema.Types.ObjectId, ref: 'Store' },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['low_stock', 'order', 'payment', 'system', 'alert', 'info', 'success', 'warning'],
      default: 'info',
    },
    isRead: { type: Boolean, default: false },
    actionUrl: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

NotificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

export default mongoose.model<INotification>('Notification', NotificationSchema);
