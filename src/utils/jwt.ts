import jwt from 'jsonwebtoken';
import dotenv from "dotenv"


dotenv.config()

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET || JWT_SECRET === 'Hey') {
  throw new Error('JWT_SECRET env var is required and must not be a placeholder');
}
if (!JWT_REFRESH_SECRET || JWT_REFRESH_SECRET === 'Hi') {
  throw new Error('JWT_REFRESH_SECRET env var is required and must not be a placeholder');
}

export const generateToken = (payload: object, expiresIn: string = '7d'): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as any);
};

export const generateRefreshToken = (payload: object): string => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d',
  } as any);
};

export const verifyToken = (token: string): any => {
  return jwt.verify(token, JWT_SECRET);
};

export const verifyRefreshToken = (token: string): any => {
  return jwt.verify(token, JWT_REFRESH_SECRET);
};
