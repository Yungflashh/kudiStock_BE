import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  email?: string;
  phoneNumber?: string;
  countryCode?: string;
  password: string;
  avatar?: string;
  language: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isActive: boolean;
  role: 'admin' | 'manager' | 'staff';
  stores: mongoose.Types.ObjectId[];
  emailOTP?: string;
  emailOTPExpiry?: Date;
  phoneOTP?: string;
  phoneOTPExpiry?: Date;
  resetPasswordToken?: string;
  resetPasswordExpiry?: Date;
  refreshToken?: string;
  lastLogin?: Date;
  notificationSettings: {
    emailNotifications: boolean;
    smsNotifications: boolean;
    pushNotifications: boolean;
    lowStockAlerts: boolean;
    orderUpdates: boolean;
    paymentAlerts: boolean;
    dailyReports: boolean;
    weeklyReports: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    firstName: { type: String, required: false, trim: true, default: '' },
    lastName: { type: String, required: false, trim: true, default: '' },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    phoneNumber: { type: String, unique: true, sparse: true },
    countryCode: { type: String, default: '+234' },
    password: { type: String, required: true, minlength: 8, select: false },
    avatar: { type: String },
    language: { type: String, default: 'en' },
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    role: { type: String, enum: ['admin', 'manager', 'staff'], default: 'admin' },
    stores: [{ type: Schema.Types.ObjectId, ref: 'Store' }],
    emailOTP: { type: String, select: false },
    emailOTPExpiry: { type: Date, select: false },
    phoneOTP: { type: String, select: false },
    phoneOTPExpiry: { type: Date, select: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpiry: { type: Date, select: false },
    refreshToken: { type: String, select: false },
    lastLogin: { type: Date },
    notificationSettings: {
      emailNotifications: { type: Boolean, default: true },
      smsNotifications: { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: true },
      lowStockAlerts: { type: Boolean, default: true },
      orderUpdates: { type: Boolean, default: true },
      paymentAlerts: { type: Boolean, default: true },
      dailyReports: { type: Boolean, default: false },
      weeklyReports: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.password);
};

UserSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

export default mongoose.model<IUser>('User', UserSchema);
