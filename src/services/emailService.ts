import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

export const sendEmail = async (options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> => {
  try {
    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"${process.env.FROM_NAME || 'KudiStocks'}" <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    logger.info(`Email sent to ${options.to}`);
    return true;
  } catch (error) {
    logger.error('Email sending failed:', error);
    return false;
  }
};

export const sendOTPEmail = async (email: string, otp: string, name: string): Promise<boolean> => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
      <div style="background: #4F46E5; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0;">KudiStocks</h1>
      </div>
      <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #333;">Hello ${name},</h2>
        <p style="color: #666;">Your OTP verification code is:</p>
        <div style="background: #f0f0f0; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <h1 style="color: #4F46E5; font-size: 36px; letter-spacing: 8px; margin: 0;">${otp}</h1>
        </div>
        <p style="color: #666;">This code expires in <strong>10 minutes</strong>. Do not share this code with anyone.</p>
        <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
      </div>
    </div>
  `;
  return sendEmail({ to: email, subject: 'Your OTP Verification Code - KudiStocks', html });
};

export const sendWelcomeEmail = async (email: string, name: string): Promise<boolean> => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #4F46E5; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0;">Welcome to KudiStocks!</h1>
      </div>
      <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2>Hello ${name},</h2>
        <p>Welcome to KudiStocks! Your account has been successfully created.</p>
        <p>You can now manage your inventory, track orders, and grow your business.</p>
        <p>Get started by setting up your first store.</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">© 2024 KudiStocks. All rights reserved.</p>
      </div>
    </div>
  `;
  return sendEmail({ to: email, subject: 'Welcome to KudiStocks!', html });
};

export const sendPasswordResetEmail = async (email: string, name: string, token: string): Promise<boolean> => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
      <div style="background: #14235d; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0;">KudiStocks</h1>
      </div>
      <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #333;">Hello ${name},</h2>
        <p style="color: #666;">You requested to reset your password. Use the code below in the KudiStocks app:</p>
        <div style="background: #f0f0f0; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <h1 style="color: #14235d; font-size: 36px; letter-spacing: 8px; margin: 0;">${token}</h1>
        </div>
        <p style="color: #666;">This code expires in <strong>15 minutes</strong>. Do not share this code with anyone.</p>
        <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
      </div>
    </div>
  `;
  return sendEmail({ to: email, subject: 'Reset Your Password - KudiStocks', html });
};

export const sendLowStockAlert = async (email: string, storeName: string, products: any[]): Promise<boolean> => {
  const productRows = products.map(p => `<tr><td>${p.name}</td><td>${p.sku}</td><td style="color: red;">${p.quantity}</td><td>${p.lowStockThreshold}</td></tr>`).join('');
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #EF4444; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0;">⚠️ Low Stock Alert</h1>
      </div>
      <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px;">
        <h2>Low Stock Alert for ${storeName}</h2>
        <p>The following products are running low on stock:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead><tr style="background: #f3f4f6;"><th style="padding: 8px; border: 1px solid #ddd;">Product</th><th style="padding: 8px; border: 1px solid #ddd;">SKU</th><th style="padding: 8px; border: 1px solid #ddd;">Current Stock</th><th style="padding: 8px; border: 1px solid #ddd;">Threshold</th></tr></thead>
          <tbody>${productRows}</tbody>
        </table>
        <p>Please reorder these items to avoid stockout.</p>
      </div>
    </div>
  `;
  return sendEmail({ to: email, subject: `⚠️ Low Stock Alert - ${storeName}`, html });
};

export const sendPurchaseOrderEmail = async (
  supplierEmail: string,
  supplierName: string,
  storeName: string,
  orderNumber: string,
  items: { productName: string; quantity: number; unitPrice: number; totalPrice: number }[],
  total: number,
  notes?: string
): Promise<boolean> => {
  const itemRows = items
    .map(
      (item) =>
        `<tr>
          <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${item.productName}</td>
          <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right;">₦${item.unitPrice.toLocaleString()}</td>
          <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right;">₦${item.totalPrice.toLocaleString()}</td>
        </tr>`
    )
    .join('');

  const notesSection = notes
    ? `<div style="margin-top: 20px; padding: 12px; background: #f9fafb; border-radius: 6px;">
        <strong>Notes:</strong><br/>${notes}
      </div>`
    : '';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
      <div style="background: #3B4CCA; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0;">📦 Purchase Order</h1>
      </div>
      <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="margin-bottom: 20px;">
          <p style="margin: 4px 0;"><strong>From:</strong> ${storeName}</p>
          <p style="margin: 4px 0;"><strong>To:</strong> ${supplierName}</p>
          <p style="margin: 4px 0;"><strong>Order #:</strong> ${orderNumber}</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: left;">Item</th>
              <th style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: center;">Qty</th>
              <th style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right;">Unit Price</th>
              <th style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
          <tfoot>
            <tr style="background: #f3f4f6; font-weight: bold;">
              <td colspan="3" style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right;">Total:</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; text-align: right;">₦${total.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        ${notesSection}

        <p style="margin-top: 24px; color: #666;">Please confirm this order by replying to this email.</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">This purchase order was sent via KudiStocks.</p>
      </div>
    </div>
  `;

  return sendEmail({
    to: supplierEmail,
    subject: `📦 Purchase Order ${orderNumber} from ${storeName}`,
    html,
  });
};
