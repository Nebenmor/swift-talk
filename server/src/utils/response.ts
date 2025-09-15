import { Response } from 'express';
import { ApiResponse, PaginatedResponse } from '../types';

export class ResponseUtil {
  static success<T>(
    res: Response,
    data: T,
    message = 'Success',
    statusCode = 200
  ): Response {
    const response: ApiResponse<T> = {
      success: true,
      message,
      data,
    };

    return res.status(statusCode).json(response);
  }

  static error(
    res: Response,
    message = 'Internal server error',
    statusCode = 500,
    error?: string
  ): Response {
    const response: ApiResponse = {
      success: false,
      message,
      ...(error && { error }),
    };

    return res.status(statusCode).json(response);
  }

  static validationError(
    res: Response,
    errors: string[],
    message = 'Validation failed'
  ): Response {
    const response: ApiResponse = {
      success: false,
      message,
      error: errors.join(', '),
    };

    return res.status(400).json(response);
  }

  static unauthorized(
    res: Response,
    message = 'Unauthorized access'
  ): Response {
    return this.error(res, message, 401);
  }

  static forbidden(
    res: Response,
    message = 'Access forbidden'
  ): Response {
    return this.error(res, message, 403);
  }

  static notFound(
    res: Response,
    message = 'Resource not found'
  ): Response {
    return this.error(res, message, 404);
  }

  static conflict(
    res: Response,
    message = 'Conflict occurred'
  ): Response {
    return this.error(res, message, 409);
  }

  static tooManyRequests(
    res: Response,
    message = 'Too many requests'
  ): Response {
    return this.error(res, message, 429);
  }

  static paginated<T>(
    res: Response,
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    },
    message = 'Success'
  ): Response {
    const response: ApiResponse<PaginatedResponse<T>> = {
      success: true,
      message,
      data: {
        data,
        pagination,
      },
    };

    return res.status(200).json(response);
  }
}

export const handleAsyncError = (
  fn: (req: any, res: Response, next: any) => Promise<any>
) => {
  return (req: any, res: Response, next: any): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};