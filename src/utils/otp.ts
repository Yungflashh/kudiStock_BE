import crypto from 'crypto';

export const generateOTP = (length: number = 6): string => {
  return crypto.randomInt(0, Math.pow(10, length)).toString().padStart(length, '0');
};

export const generateSecureToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const hashOTP = (otp: string): string => {
  return crypto.createHash('sha256').update(otp).digest('hex');
};

export const verifyOTPHash = (otp: string, hash: string): boolean => {
  const hashedOTP = hashOTP(otp);
  try {
    return crypto.timingSafeEqual(Buffer.from(hashedOTP), Buffer.from(hash));
  } catch {
    return false;
  }
};
