import mongoose from 'mongoose';
import { logger } from '../utils/logger';

export const connectDB = async (): Promise<void> => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/inventory_db';

  try {
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
    });

  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    throw error;
  }
};
