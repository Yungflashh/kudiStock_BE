import { Router } from 'express';
import { body } from 'express-validator';
import {
  register, login, verifyOTP, resendOTP, forgotPassword,
  resetPassword, refreshToken, logout, getProfile, updateProfile, changePassword,
  sendEmailOTP, verifyEmailOTPPublic,
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { authRateLimiter, otpRateLimiter } from '../middleware/rateLimiter';
import { upload } from '../services/uploadService';

const router = Router();

router.post('/send-email-otp', authRateLimiter,
  [body('email').isEmail().withMessage('Valid email is required')],
  validate,
  sendEmailOTP
);

router.post('/verify-email-otp',
  otpRateLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  ],
  validate,
  verifyEmailOTPPublic
);

router.post('/register',
  authRateLimiter,
  [
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('email').optional().isEmail().withMessage('Valid email is required'),
    body('phoneNumber').optional().notEmpty().withMessage('Phone number cannot be empty'),
  ],
  validate,
  register
);

router.post('/login',
  authRateLimiter,
  [
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  login
);

router.post('/verify-otp', authenticate, otpRateLimiter,
  [
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    body('type').isIn(['email', 'phone']).withMessage('Type must be email or phone'),
  ],
  validate,
  verifyOTP
);

router.post('/resend-otp', authenticate, otpRateLimiter,
  [body('type').isIn(['email', 'phone']).withMessage('Type must be email or phone')],
  validate,
  resendOTP
);

router.post('/forgot-password', authRateLimiter,
  [body('email').isEmail().withMessage('Valid email is required')],
  validate,
  forgotPassword
);

router.post('/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  validate,
  resetPassword
);

router.post('/refresh-token',
  [body('refreshToken').notEmpty().withMessage('Refresh token is required')],
  validate,
  refreshToken
);

router.post('/logout', authenticate, logout);
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, upload.single('avatar'), updateProfile);
router.put('/change-password', authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  ],
  validate,
  changePassword
);

export default router;
