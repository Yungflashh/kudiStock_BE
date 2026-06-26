import mongoose, { Document, Schema } from 'mongoose';

export interface IStore extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  category: string;
  owner: mongoose.Types.ObjectId;
  managers: mongoose.Types.ObjectId[];
  staff: mongoose.Types.ObjectId[];
  description?: string;
  logo?: string;
  country: string;
  state: string;
  city: string;
  address: string;
  zipCode?: string;
  phoneNumber?: string;
  email?: string;
  website?: string;
  currency: string;
  isActive: boolean;
  isVerified: boolean;
  verificationStatus: 'pending' | 'submitted' | 'verified' | 'rejected';
  businessRegistrationNumber?: string;
  nin?: string;
  verificationDocuments: {
    type: string;
    url: string;
    uploadedAt: Date;
  }[];
  verificationNotes?: string;
  bankAccounts: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    routingNumber?: string;
    isDefault: boolean;
  }[];
  settings: {
    lowStockThreshold: number;
    taxRate: number;
    allowNegativeStock: boolean;
    autoReorder: boolean;
  };
  walletBalance: number;
  createdAt: Date;
  updatedAt: Date;
}

const StoreSchema = new Schema<IStore>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true },
    category: { type: String, required: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    managers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    staff: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    description: { type: String },
    logo: { type: String },
    country: { type: String, required: true },
    state: { type: String, required: true },
    city: { type: String, required: true },
    address: { type: String, required: true },
    zipCode: { type: String },
    phoneNumber: { type: String },
    email: { type: String, lowercase: true },
    website: { type: String },
    currency: { type: String, default: 'NGN' },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    verificationStatus: {
      type: String,
      enum: ['pending', 'submitted', 'verified', 'rejected'],
      default: 'pending',
    },
    businessRegistrationNumber: { type: String },
    nin: { type: String },
    verificationDocuments: [
      {
        type: { type: String },
        url: { type: String },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    verificationNotes: { type: String },
    bankAccounts: [
      {
        bankName: { type: String, required: true },
        accountNumber: { type: String, required: true },
        accountName: { type: String, required: true },
        routingNumber: { type: String },
        isDefault: { type: Boolean, default: false },
      },
    ],
    settings: {
      lowStockThreshold: { type: Number, default: 10 },
      taxRate: { type: Number, default: 0 },
      allowNegativeStock: { type: Boolean, default: false },
      autoReorder: { type: Boolean, default: false },
    },
    walletBalance: { type: Number, default: 0 },
  },
  { timestamps: true }
);

StoreSchema.pre('save', function (next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') + '-' + Date.now();
  }
  next();
});

StoreSchema.index({ owner: 1 });
StoreSchema.index({ managers: 1 });
StoreSchema.index({ staff: 1 });

export default mongoose.model<IStore>('Store', StoreSchema);
