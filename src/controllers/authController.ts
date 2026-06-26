import { Request, Response } from 'express';
import User from '../models/User';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { generateOTP, hashOTP, verifyOTPHash } from '../utils/otp';
import { successResponse, errorResponse } from '../utils/response';
import { sendOTPEmail, sendWelcomeEmail, sendPasswordResetEmail } from '../services/emailService';
import { sendOTPSMS, formatPhoneNumber } from '../services/smsService';
import { uploadToCloudinary } from '../services/uploadService';
import { logger } from '../utils/logger';
import { AuthRequest } from '../middleware/auth';

// In-memory stores for registration OTP flow (cleared on server restart — fine for dev)
const pendingOTPs = new Map<string, { hash: string; expiry: Date }>();
const verifiedEmails = new Map<string, Date>();

export const sendEmailOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    const key = email.toLowerCase();

    const existing = await User.findOne({ email: key });
    if (existing) {
      errorResponse(res, 'An account with this email already exists.', 409);
      return;
    }

    const otp = generateOTP();
    const hashedOTP = hashOTP(otp);
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    pendingOTPs.set(key, { hash: hashedOTP, expiry });

    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n🔐 OTP for ${email}: ${otp}\n`);
      logger.info(`[DEV] Registration OTP for ${email}: ${otp}`);
    }

    sendOTPEmail(email, otp, 'there').catch((err: Error) => logger.error('OTP email failed:', err));

    successResponse(res, 'Verification code sent to your email.');
  } catch (error: any) {
    logger.error('Send email OTP error:', error);
    errorResponse(res, 'Failed to send OTP. Please try again.', 500);
  }
};

export const verifyEmailOTPPublic = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp } = req.body;
    const key = email.toLowerCase();

    const stored = pendingOTPs.get(key);
    if (!stored) {
      errorResponse(res, 'No OTP found for this email. Please request a new one.', 400);
      return;
    }
    if (stored.expiry < new Date()) {
      pendingOTPs.delete(key);
      errorResponse(res, 'OTP has expired. Please request a new one.', 400);
      return;
    }
    if (!verifyOTPHash(otp, stored.hash)) {
      errorResponse(res, 'Invalid OTP. Please check and try again.', 400);
      return;
    }

    pendingOTPs.delete(key);
    // Mark email as verified for 15 min so registration can complete
    verifiedEmails.set(key, new Date(Date.now() + 15 * 60 * 1000));

    successResponse(res, 'Email verified successfully!');
  } catch (error: any) {
    logger.error('Verify email OTP error:', error);
    errorResponse(res, 'Verification failed. Please try again.', 500);
  }
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, phoneNumber, countryCode, password, language, firstName, lastName } = req.body;

    if (!email && !phoneNumber) {
      errorResponse(res, 'Email or phone number is required to register.', 400);
      return;
    }

    if (email) {
      const key = email.toLowerCase();
      const verifiedExpiry = verifiedEmails.get(key);
      if (!verifiedExpiry || verifiedExpiry < new Date()) {
        verifiedEmails.delete(key);
        errorResponse(res, 'Please verify your email first.', 400);
        return;
      }
      const existingEmail = await User.findOne({ email: key });
      if (existingEmail) {
        errorResponse(res, 'An account with this email already exists.', 409);
        return;
      }
    }

    if (phoneNumber) {
      const existingPhone = await User.findOne({ phoneNumber });
      if (existingPhone) {
        errorResponse(res, 'An account with this phone number already exists.', 409);
        return;
      }
    }

    const user = await User.create({
      firstName: firstName || '',
      lastName: lastName || '',
      email: email?.toLowerCase(),
      phoneNumber,
      countryCode: countryCode || '+234',
      password,
      language: language || 'en',
      isEmailVerified: !!email,
    });

    if (email) verifiedEmails.delete(email.toLowerCase());

    const token = generateToken({ id: user._id });
    const refreshToken = generateRefreshToken({ id: user._id });
    user.refreshToken = refreshToken;
    await user.save();

    sendWelcomeEmail(email, 'there').catch(() => {});

    successResponse(res, 'Registration successful! Welcome to KudiStocks.', {
      token,
      refreshToken,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        language: user.language,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        role: user.role,
        stores: user.stores,
      },
    }, 201);
  } catch (error: any) {
    logger.error('Register error:', error);
    errorResponse(res, error.message || 'Registration failed. Please try again.', 500);
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, phoneNumber, password } = req.body;

    if (!email && !phoneNumber) {
      errorResponse(res, 'Email or phone number is required.', 400);
      return;
    }

    const query = email ? { email: email.toLowerCase() } : { phoneNumber };
    const user = await User.findOne(query).select('+password +refreshToken');

    if (!user) {
      errorResponse(res, 'Invalid credentials. Please check your email/phone and password.', 401);
      return;
    }

    if (!user.isActive) {
      errorResponse(res, 'Your account has been deactivated. Please contact support.', 403);
      return;
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      errorResponse(res, 'Invalid credentials. Please check your email/phone and password.', 401);
      return;
    }

    const token = generateToken({ id: user._id });
    const refreshToken = generateRefreshToken({ id: user._id });

    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save();

    successResponse(res, 'Login successful! Welcome back.', {
      token,
      refreshToken,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        language: user.language,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        role: user.role,
        stores: user.stores,
      },
    });
  } catch (error: any) {
    logger.error('Login error:', error);
    errorResponse(res, 'Login failed. Please try again.', 500);
  }
};

export const verifyOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { otp, type } = req.body; // type: 'email' | 'phone'
    const authReq = req as AuthRequest;
    const userId = authReq.user!._id;

    const user = await User.findById(userId).select('+emailOTP +emailOTPExpiry +phoneOTP +phoneOTPExpiry');
    if (!user) {
      errorResponse(res, 'User not found.', 404);
      return;
    }

    if (type === 'email') {
      if (!user.emailOTP) {
        errorResponse(res, 'No OTP found. Please request a new OTP.', 400);
        return;
      }
      if (user.emailOTPExpiry && user.emailOTPExpiry < new Date()) {
        errorResponse(res, 'OTP has expired. Please request a new one.', 400);
        return;
      }
      if (!verifyOTPHash(otp, user.emailOTP)) {
        errorResponse(res, 'Invalid OTP. Please check and try again.', 400);
        return;
      }
      user.isEmailVerified = true;
      user.emailOTP = undefined;
      user.emailOTPExpiry = undefined;
    } else {
      if (!user.phoneOTP) {
        errorResponse(res, 'No OTP found. Please request a new OTP.', 400);
        return;
      }
      if (user.phoneOTPExpiry && user.phoneOTPExpiry < new Date()) {
        errorResponse(res, 'OTP has expired. Please request a new one.', 400);
        return;
      }
      if (!verifyOTPHash(otp, user.phoneOTP)) {
        errorResponse(res, 'Invalid OTP. Please check and try again.', 400);
        return;
      }
      user.isPhoneVerified = true;
      user.phoneOTP = undefined;
      user.phoneOTPExpiry = undefined;
    }

    await user.save();

    if (user.email) await sendWelcomeEmail(user.email, user.firstName);

    successResponse(res, `${type === 'email' ? 'Email' : 'Phone number'} verified successfully!`);
  } catch (error: any) {
    logger.error('OTP verification error:', error);
    errorResponse(res, 'Verification failed. Please try again.', 500);
  }
};

export const resendOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type } = req.body;
    const authReq = req as AuthRequest;
    const userId = authReq.user!._id;

    const user = await User.findById(userId);
    if (!user) {
      errorResponse(res, 'User not found.', 404);
      return;
    }

    const otp = generateOTP();
    const hashedOTP = hashOTP(otp);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    if (type === 'email') {
      if (!user.email) {
        errorResponse(res, 'No email address associated with this account.', 400);
        return;
      }
      user.emailOTP = hashedOTP;
      user.emailOTPExpiry = otpExpiry;
      await user.save();
      await sendOTPEmail(user.email, otp, user.firstName);
      successResponse(res, 'OTP sent to your email address. Please check your inbox.');
    } else {
      if (!user.phoneNumber) {
        errorResponse(res, 'No phone number associated with this account.', 400);
        return;
      }
      const formattedPhone = formatPhoneNumber(user.phoneNumber, user.countryCode || '+234');
      user.phoneOTP = hashedOTP;
      user.phoneOTPExpiry = otpExpiry;
      await user.save();
      await sendOTPSMS(formattedPhone, otp);
      successResponse(res, 'OTP sent to your phone number via SMS.');
    }
  } catch (error: any) {
    logger.error('Resend OTP error:', error);
    errorResponse(res, 'Failed to resend OTP. Please try again.', 500);
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    // Always return success to prevent email enumeration
    if (!user) {
      successResponse(res, 'If an account with this email exists, a password reset link has been sent.');
      return;
    }

    const resetToken = generateOTP();
    user.resetPasswordToken = hashOTP(resetToken);
    user.resetPasswordExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await user.save();

    if (process.env.NODE_ENV === 'development') {
      logger.info(`[DEV] Password reset code for ${email}: ${resetToken}`);
    }

    await sendPasswordResetEmail(email, user.firstName, resetToken);
    successResponse(res, 'If an account with this email exists, a password reset link has been sent.');
  } catch (error: any) {
    logger.error('Forgot password error:', error);
    errorResponse(res, 'Failed to process password reset. Please try again.', 500);
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body;

    const hashedToken = hashOTP(token);
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpiry: { $gt: new Date() },
    });

    if (!user) {
      errorResponse(res, 'Invalid or expired reset token. Please request a new one.', 400);
      return;
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    await user.save();

    successResponse(res, 'Password reset successful! You can now log in with your new password.');
  } catch (error: any) {
    logger.error('Reset password error:', error);
    errorResponse(res, 'Password reset failed. Please try again.', 500);
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      errorResponse(res, 'Refresh token is required.', 400);
      return;
    }

    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user || user.refreshToken !== token) {
      errorResponse(res, 'Invalid refresh token. Please log in again.', 401);
      return;
    }

    const newToken = generateToken({ id: user._id });
    const newRefreshToken = generateRefreshToken({ id: user._id });

    user.refreshToken = newRefreshToken;
    await user.save();

    successResponse(res, 'Token refreshed successfully.', { token: newToken, refreshToken: newRefreshToken });
  } catch (error: any) {
    logger.error('Refresh token error:', error);
    errorResponse(res, 'Token refresh failed. Please log in again.', 401);
  }
};

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, { $unset: { refreshToken: 1 } });
    }
    successResponse(res, 'Logged out successfully.');
  } catch (error: any) {
    logger.error('Logout error:', error);
    errorResponse(res, 'Logout failed.', 500);
  }
};

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user._id)
      .select('firstName lastName email phoneNumber language isEmailVerified isPhoneVerified role stores avatar notificationSettings')
      .populate('stores', 'name slug logo category');
    if (!user) {
      errorResponse(res, 'User not found.', 404);
      return;
    }
    successResponse(res, 'Profile retrieved successfully.', user);
  } catch (error: any) {
    logger.error('Get profile error:', error);
    errorResponse(res, 'Failed to retrieve profile.', 500);
  }
};

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowedFields = ['firstName', 'lastName', 'language', 'notificationSettings'];
    const updateData: any = {};

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    if (req.file) {
      const { url } = await uploadToCloudinary(req.file.buffer, 'avatars');
      updateData.avatar = url;
    } else if (req.body.avatar !== undefined) {
      updateData.avatar = req.body.avatar;
    }

    const user = await User.findByIdAndUpdate(req.user._id, updateData, { new: true, runValidators: true });
    successResponse(res, 'Profile updated successfully.', user);
  } catch (error: any) {
    logger.error('Update profile error:', error);
    errorResponse(res, 'Failed to update profile.', 500);
  }
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      errorResponse(res, 'User not found.', 404);
      return;
    }

    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      errorResponse(res, 'Current password is incorrect.', 400);
      return;
    }

    user.password = newPassword;
    await user.save();

    successResponse(res, 'Password changed successfully.');
  } catch (error: any) {
    logger.error('Change password error:', error);
    errorResponse(res, 'Failed to change password.', 500);
  }
};
