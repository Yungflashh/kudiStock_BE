import { Router } from 'express';
import { body } from 'express-validator';
import {
  createStore, getMyStores, getStore, updateStore,
  submitVerification, addBankAccount, removeBankAccount,
  getWallet, deleteStore,
} from '../controllers/storeController';
import { authenticate, requireStoreAccess, requireOwner, requireOwnerOrManager } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { upload } from '../services/uploadService';

const router = Router();

router.use(authenticate);

router.post('/',
  upload.single('logo'),
  [
    body('name').trim().notEmpty().withMessage('Store name is required'),
    body('category').notEmpty().withMessage('Store category is required'),
    body('country').notEmpty().withMessage('Country is required'),
    body('state').notEmpty().withMessage('State is required'),
    body('city').notEmpty().withMessage('City is required'),
    body('address').notEmpty().withMessage('Address is required'),
  ],
  validate,
  createStore
);

router.get('/', getMyStores);

router.get('/:storeId', requireStoreAccess, getStore);
router.put('/:storeId', requireStoreAccess, requireOwnerOrManager, upload.single('logo'), updateStore);
router.delete('/:storeId', requireStoreAccess, requireOwner, deleteStore);

router.post('/:storeId/verify', requireStoreAccess, requireOwner, upload.array('documents', 5), submitVerification);

router.post('/:storeId/bank-accounts', requireStoreAccess, requireOwner,
  [
    body('bankName').notEmpty().withMessage('Bank name is required'),
    body('accountNumber').notEmpty().withMessage('Account number is required'),
    body('accountName').notEmpty().withMessage('Account name is required'),
  ],
  validate,
  addBankAccount
);

router.delete('/:storeId/bank-accounts/:accountId', requireStoreAccess, requireOwner, removeBankAccount);
router.get('/:storeId/wallet', requireStoreAccess, getWallet);

export default router;
