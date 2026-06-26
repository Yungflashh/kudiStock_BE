import mongoose, { Document, Schema } from 'mongoose';

export interface ITransaction extends Document {
  _id: mongoose.Types.ObjectId;
  store: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  type: 'credit' | 'debit';
  category: 'sale' | 'purchase' | 'refund' | 'withdrawal' | 'deposit' | 'fee' | 'adjustment';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reference: string;
  description: string;
  order?: mongoose.Types.ObjectId;
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    store: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['credit', 'debit'], required: true },
    category: {
      type: String,
      enum: ['sale', 'purchase', 'refund', 'withdrawal', 'deposit', 'fee', 'adjustment'],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    reference: { type: String, unique: true },
    description: { type: String, required: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'reversed'],
      default: 'completed',
    },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

import crypto from 'crypto';

TransactionSchema.pre('save', function (next) {
  if (!this.reference) {
    this.reference = 'TXN-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  }
  next();
});

TransactionSchema.index({ store: 1, createdAt: -1 });
TransactionSchema.index({ store: 1, category: 1, createdAt: -1 });

export default mongoose.model<ITransaction>('Transaction', TransactionSchema);
