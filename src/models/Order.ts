import mongoose, { Document, Schema } from 'mongoose';

export interface IOrderItem {
  product?: mongoose.Types.ObjectId;
  productName: string;
  sku: string;
  image?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface IOrder extends Document {
  _id: mongoose.Types.ObjectId;
  orderNumber: string;
  store: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  supplier: mongoose.Types.ObjectId;
  items: IOrderItem[];
  subtotal: number;
  total: number;
  status: 'pending' | 'sent' | 'confirmed' | 'in_transit' | 'delivered' | 'cancelled';
  notes?: string;
  emailSentToSupplier: boolean;
  deliveredAt?: Date;
  statusHistory: {
    status: string;
    changedBy: mongoose.Types.ObjectId;
    changedAt: Date;
    note?: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, unique: true },
    store: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
    items: [
      {
        product: { type: Schema.Types.ObjectId, ref: 'Product' },
        productName: { type: String, required: true },
        sku: { type: String, default: '' },
        image: { type: String },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        totalPrice: { type: Number, required: true, min: 0 },
      },
    ],
    subtotal: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'sent', 'confirmed', 'in_transit', 'delivered', 'cancelled'],
      default: 'pending',
    },
    notes: { type: String },
    emailSentToSupplier: { type: Boolean, default: false },
    deliveredAt: { type: Date },
    statusHistory: [
      {
        status: { type: String },
        changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        changedAt: { type: Date, default: Date.now },
        note: { type: String },
      },
    ],
  },
  { timestamps: true }
);

import crypto from 'crypto';

OrderSchema.pre('save', function (next) {
  if (!this.orderNumber) {
    this.orderNumber = 'PO-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  }
  next();
});

OrderSchema.index({ store: 1, createdAt: -1 });
OrderSchema.index({ orderNumber: 1 });
OrderSchema.index({ supplier: 1 });

export default mongoose.model<IOrder>('Order', OrderSchema);
