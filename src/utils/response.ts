import { Response } from 'express';

export const successResponse = (
  res: Response,
  message: string,
  data: any = null,
  statusCode: number = 200
) => {
  const response: any = { success: true, message };
  if (data !== null) response.data = data;
  return res.status(statusCode).json(response);
};

export const errorResponse = (
  res: Response,
  message: string,
  statusCode: number = 400,
  errors: any = null
) => {
  const response: any = { success: false, message };
  if (errors) response.errors = errors;
  return res.status(statusCode).json(response);
};

export const paginatedResponse = (
  res: Response,
  message: string,
  data: any[],
  pagination: { total: number; page: number; limit: number; pages: number }
) => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination,
  });
};
