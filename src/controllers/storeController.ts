import { Response } from 'express';
import Store from '../models/Store';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import { uploadToCloudinary } from '../services/uploadService';
import { logger } from '../utils/logger';

export const createStore = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      name, category, description, country, state, city, address, zipCode,
      phoneNumber, email, website, currency,
    } = req.body;

    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') + '-' + Date.now();

    let logoUrl = '';
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, 'inventory/stores');
      logoUrl = result.url;
    }

    const store = await Store.create({
      name, slug, category, description, country, state, city, address,
      zipCode, phoneNumber, email, website, currency: currency || 'NGN',
      logo: logoUrl, owner: req.user._id,
    });

    // Add store to user's stores list
    await User.findByIdAndUpdate(req.user._id, { $push: { stores: store._id } });

    successResponse(res, 'Store created successfully! You can now set it up.', store, 201);
  } catch (error: any) {
    logger.error('Create store error:', error);
    errorResponse(res, error.message || 'Failed to create store.', 500);
  }
};

export const getMyStores = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stores = await Store.find({
      $or: [
        { owner: req.user._id },
        { managers: req.user._id },
        { staff: req.user._id },
      ],
    }).populate('owner', 'firstName lastName email');

    successResponse(res, 'Stores retrieved successfully.', stores);
  } catch (error: any) {
    logger.error('Get stores error:', error);
    errorResponse(res, 'Failed to retrieve stores.', 500);
  }
};

export const getStore = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await Store.findById(req.params.storeId)
      .select('-nin -businessRegistrationNumber -bankAccounts')
      .populate('owner', 'firstName lastName email avatar');
    if (!store) {
      errorResponse(res, 'Store not found.', 404);
      return;
    }
    successResponse(res, 'Store retrieved successfully.', store);
  } catch (error: any) {
    logger.error('Get store error:', error);
    errorResponse(res, 'Failed to retrieve store.', 500);
  }
};

export const updateStore = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const allowedFields = [
      'name', 'category', 'description', 'country', 'state', 'city', 'address',
      'zipCode', 'phoneNumber', 'email', 'website', 'currency', 'settings',
    ];
    const updateData: any = {};
    allowedFields.forEach(f => { if (req.body[f] !== undefined) updateData[f] = req.body[f]; });

    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, 'inventory/stores');
      updateData.logo = result.url;
    }

    const store = await Store.findByIdAndUpdate(req.params.storeId, updateData, { new: true, runValidators: true });
    if (!store) {
      errorResponse(res, 'Store not found.', 404);
      return;
    }
    successResponse(res, 'Store updated successfully.', store);
  } catch (error: any) {
    logger.error('Update store error:', error);
    errorResponse(res, 'Failed to update store.', 500);
  }
};

export const submitVerification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { businessRegistrationNumber, nin, verificationNotes } = req.body;
    const store = req.store;

    const documents: { type: string; url: string; uploadedAt: Date }[] = [];

    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files as Express.Multer.File[]) {
        const result = await uploadToCloudinary(file.buffer, 'inventory/verification', 'raw');
        documents.push({ type: file.originalname, url: result.url, uploadedAt: new Date() });
      }
    }

    await Store.findByIdAndUpdate(store._id, {
      businessRegistrationNumber,
      nin,
      verificationNotes,
      $push: { verificationDocuments: { $each: documents } },
      verificationStatus: 'submitted',
    });

    successResponse(res, 'Verification documents submitted successfully. We will review and get back to you shortly.');
  } catch (error: any) {
    logger.error('Submit verification error:', error);
    errorResponse(res, 'Failed to submit verification. Please try again.', 500);
  }
};

export const addBankAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { bankName, accountNumber, accountName, routingNumber, isDefault } = req.body;

    const updateOps: any = {
      $push: { bankAccounts: { bankName, accountNumber, accountName, routingNumber, isDefault: false } },
    };

    if (isDefault) {
      // Remove default from others first
      await Store.findByIdAndUpdate(req.params.storeId, {
        $set: { 'bankAccounts.$[].isDefault': false },
      });
      updateOps.$push.bankAccounts.isDefault = true;
    }

    const store = await Store.findByIdAndUpdate(req.params.storeId, updateOps, { new: true });
    successResponse(res, 'Bank account added successfully.', store?.bankAccounts);
  } catch (error: any) {
    logger.error('Add bank account error:', error);
    errorResponse(res, 'Failed to add bank account.', 500);
  }
};

export const removeBankAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await Store.findByIdAndUpdate(
      req.params.storeId,
      { $pull: { bankAccounts: { _id: req.params.accountId } } },
      { new: true }
    );
    successResponse(res, 'Bank account removed successfully.', store?.bankAccounts);
  } catch (error: any) {
    logger.error('Remove bank account error:', error);
    errorResponse(res, 'Failed to remove bank account.', 500);
  }
};

export const getWallet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await Store.findById(req.params.storeId).select('walletBalance bankAccounts name');
    if (!store) {
      errorResponse(res, 'Store not found.', 404);
      return;
    }
    successResponse(res, 'Wallet information retrieved successfully.', {
      balance: store.walletBalance,
      bankAccounts: store.bankAccounts,
      storeName: store.name,
    });
  } catch (error: any) {
    logger.error('Get wallet error:', error);
    errorResponse(res, 'Failed to retrieve wallet information.', 500);
  }
};

export const deleteStore = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await Store.findById(req.params.storeId);
    if (!store) {
      errorResponse(res, 'Store not found.', 404);
      return;
    }

    if (store.owner.toString() !== req.user._id.toString()) {
      errorResponse(res, 'Only the store owner can delete this store.', 403);
      return;
    }

    await Store.findByIdAndDelete(req.params.storeId);
    await User.findByIdAndUpdate(req.user._id, { $pull: { stores: store._id } });

    successResponse(res, 'Store deleted successfully.');
  } catch (error: any) {
    logger.error('Delete store error:', error);
    errorResponse(res, 'Failed to delete store.', 500);
  }
};
