import mongoose, { Document, Schema } from 'mongoose';

export interface ISupplier extends Document {
  _id: mongoose.Types.ObjectId;
  store: mongoose.Types.ObjectId;
  name: string;
  companyName?: string;
  email?: string;
  phoneNumber?: string;
  country?: string;
  state?: string;
  city?: string;
  address?: string;
  notes?: string;
  isActive: boolean;
  totalOrders: number;
  totalSpent: number;
  rating?: number;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierSchema = new Schema<ISupplier>(
  {
    store: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    name: { type: String, required: true, trim: true },
    companyName: { type: String },
    email: { type: String, lowercase: true },
    phoneNumber: { type: String },
    country: { type: String },
    state: { type: String },
    city: { type: String },
    address: { type: String },
    notes: { type: String },
    isActive: { type: Boolean, default: true },
    totalOrders: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    rating: { type: Number, min: 1, max: 5 },
  },
  { timestamps: true }
);

SupplierSchema.index({ store: 1, isActive: 1 });

export default mongoose.model<ISupplier>('Supplier', SupplierSchema);
