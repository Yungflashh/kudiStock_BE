import { Request } from 'express';

export interface PaginationOptions {
  page: number;
  limit: number;
  skip: number;
}

export const getPagination = (req: Request): PaginationOptions => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

export const getPaginationMeta = (total: number, page: number, limit: number) => {
  return {
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
    hasNext: page < Math.ceil(total / limit),
    hasPrev: page > 1,
  };
};
