import mongoose, { Document, Schema } from 'mongoose';

export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;
  store: mongoose.Types.ObjectId;
  name: string;
  sku: string;
  barcode?: string;
  description?: string;
  category: string;
  subCategory?: string;
  brand?: string;
  images: string[];
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  unit: string;
  lowStockThreshold: number;
  reorderPoint: number;
  reorderQuantity: number;
  supplier?: mongoose.Types.ObjectId;
  location?: string;
  expiryDate?: Date;
  weight?: number;
  dimensions?: { length: number; width: number; height: number };
  tags: string[];
  isActive: boolean;
  isFeatured: boolean;
  variants: {
    name: string;
    value: string;
    additionalCost: number;
    quantity: number;
  }[];
  totalSold: number;
  totalRevenue: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    store: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true },
    barcode: { type: String },
    description: { type: String },
    category: { type: String, required: true },
    subCategory: { type: String },
    brand: { type: String },
    images: [{ type: String }],
    costPrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, default: 0, min: 0 },
    unit: { type: String, default: 'piece' },
    lowStockThreshold: { type: Number, default: 10 },
    reorderPoint: { type: Number, default: 5 },
    reorderQuantity: { type: Number, default: 50 },
    supplier: { type: Schema.Types.ObjectId, ref: 'Supplier' },
    location: { type: String },
    expiryDate: { type: Date },
    weight: { type: Number },
    dimensions: {
      length: { type: Number },
      width: { type: Number },
      height: { type: Number },
    },
    tags: [{ type: String }],
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    variants: [
      {
        name: { type: String },
        value: { type: String },
        additionalCost: { type: Number, default: 0 },
        quantity: { type: Number, default: 0 },
      },
    ],
    totalSold: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ProductSchema.index({ store: 1, sku: 1 }, { unique: true });
ProductSchema.index({ store: 1, name: 'text', description: 'text' });

export default mongoose.model<IProduct>('Product', ProductSchema);
