import cloudinaryV2 from '../config/cloudinary';
import multer from 'multer';
import { Request } from 'express';
import { logger } from '../utils/logger';

// Multer memory storage
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, GIF, and PDF are allowed.'));
    }
  },
});

export const uploadToCloudinary = async (
  fileBuffer: Buffer,
  folder: string = 'inventory',
  resourceType: 'image' | 'raw' = 'image'
): Promise<{ url: string; publicId: string }> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinaryV2.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        transformation: resourceType === 'image' ? [{ quality: 'auto', fetch_format: 'auto' }] : undefined,
      },
      (error, result) => {
        if (error) {
          logger.error('Cloudinary upload failed:', error);
          reject(error);
        } else if (result) {
          resolve({ url: result.secure_url, publicId: result.public_id });
        } else {
          reject(new Error('Upload failed: no result returned'));
        }
      }
    );
    uploadStream.end(fileBuffer);
  });
};

export const deleteFromCloudinary = async (publicId: string): Promise<boolean> => {
  try {
    await cloudinaryV2.uploader.destroy(publicId);
    return true;
  } catch (error) {
    logger.error('Cloudinary delete failed:', error);
    return false;
  }
};
