import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import User from '../models/User';
import Store from '../models/Store';
import { errorResponse } from '../utils/response';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  user?: any;
  store?: any;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      errorResponse(res, 'Authentication required. Please provide a valid token.', 401);
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      errorResponse(res, 'User not found. Token may be invalid.', 401);
      return;
    }

    if (!user.isActive) {
      errorResponse(res, 'Your account has been deactivated. Please contact support.', 403);
      return;
    }

    req.user = user;
    next();
  } catch (error: any) {
    logger.error('Auth middleware error:', error.message);
    if (error.name === 'TokenExpiredError') {
      errorResponse(res, 'Session expired. Please log in again.', 401);
    } else {
      errorResponse(res, 'Invalid or expired token.', 401);
    }
  }
};

export const requireStoreAccess = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const storeId = req.params.storeId || req.body.storeId || req.query.storeId;
    if (!storeId) {
      errorResponse(res, 'Store ID is required.', 400);
      return;
    }

    const store = await Store.findById(storeId);
    if (!store) {
      errorResponse(res, 'Store not found.', 404);
      return;
    }

    if (!store.isActive) {
      errorResponse(res, 'This store is currently inactive.', 403);
      return;
    }

    const userId = req.user._id.toString();
    const isOwner = store.owner.toString() === userId;
    const isManager = store.managers.map(m => m.toString()).includes(userId);
    const isStaff = store.staff.map(s => s.toString()).includes(userId);

    if (!isOwner && !isManager && !isStaff) {
      errorResponse(res, 'You do not have access to this store.', 403);
      return;
    }

    req.store = store;
    next();
  } catch (error) {
    logger.error('Store access middleware error:', error);
    errorResponse(res, 'Failed to verify store access.', 500);
  }
};

export const requireOwnerOrManager = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const store = req.store;
    if (!store) {
      errorResponse(res, 'Store context missing.', 400);
      return;
    }

    const userId = req.user._id.toString();
    const isOwner = store.owner.toString() === userId;
    const isManager = store.managers.map((m: any) => m.toString()).includes(userId);

    if (!isOwner && !isManager) {
      errorResponse(res, 'You need manager or owner permissions for this action.', 403);
      return;
    }
    next();
  } catch (error) {
    errorResponse(res, 'Permission check failed.', 500);
  }
};

export const requireOwner = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const store = req.store;
    if (!store) {
      errorResponse(res, 'Store context missing.', 400);
      return;
    }

    const userId = req.user._id.toString();
    if (store.owner.toString() !== userId) {
      errorResponse(res, 'Only the store owner can perform this action.', 403);
      return;
    }
    next();
  } catch (error) {
    errorResponse(res, 'Permission check failed.', 500);
  }
};
