import { logger } from '../utils/logger';

let twilioClient: any = null;

const getTwilioClient = () => {
  if (!twilioClient) {
    try {
      const twilio = require('twilio');
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      }
    } catch (error) {
      logger.warn('Twilio not configured');
    }
  }
  return twilioClient;
};

export const sendSMS = async (phoneNumber: string, message: string): Promise<boolean> => {
  try {
    const client = getTwilioClient();
    if (!client) {
      logger.warn('SMS service not configured. SMS not sent to:', phoneNumber);
      return false;
    }

    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });

    logger.info(`SMS sent to ${phoneNumber}`);
    return true;
  } catch (error) {
    logger.error('SMS sending failed:', error);
    return false;
  }
};

export const sendOTPSMS = async (phoneNumber: string, otp: string): Promise<boolean> => {
  const message = `Your InventoryPro verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`;
  return sendSMS(phoneNumber, message);
};

export const formatPhoneNumber = (phone: string, countryCode: string = '+234'): string => {
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (phone.startsWith('+')) return phone;
  if (cleaned.startsWith('0')) return countryCode + cleaned.slice(1);
  return countryCode + cleaned;
};
