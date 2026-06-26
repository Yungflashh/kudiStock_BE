import { Router } from 'express';
import { body } from 'express-validator';
import { getAIInsights, generateProductDesc, getForecast, aiChat } from '../controllers/miscControllers';
import { authenticate, requireStoreAccess } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();
router.use(authenticate);

router.post('/stores/:storeId/insights', requireStoreAccess,
  [body('type').isIn(['inventory', 'sales', 'supplier', 'general']).withMessage('Invalid insight type')],
  validate,
  getAIInsights
);

router.post('/stores/:storeId/forecast', requireStoreAccess, getForecast);

router.post('/generate-description',
  [
    body('name').notEmpty().withMessage('Product name is required'),
    body('category').notEmpty().withMessage('Category is required'),
  ],
  validate,
  generateProductDesc
);

router.post('/chat',
  [body('messages').isArray({ min: 1 }).withMessage('Messages array is required')],
  validate,
  aiChat
);

export default router;
