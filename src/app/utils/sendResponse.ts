import { Response } from 'express';
type TMeta = {
  page: number;
  limit: number;
  total: number;
};
type TResponse<T> = {
  statusCode: number;
  success: boolean;
  message?: string;
  meta?: TMeta;
  data: T;
};

const createSendResponse = <T>(res: Response, data: TResponse<T>) => {
  // console.log('res', data);
  res.status(data?.statusCode).json({
    success: data.success,
    statusCode: data.statusCode,
    message: data.message,
    data: data.data,
  });
};

const getSendResponse = <T>(res: Response, data: TResponse<T>) => {
  // console.log('res', data);
  res.status(data?.statusCode).json({
    success: data.success,
    statusCode: data.statusCode,
    message: data.message,
    meta: {
      page: parseInt(String(data?.meta?.page)),
      limit: parseInt(String(data?.meta?.limit)),
      total: parseInt(String(data?.meta?.total)),
    },

    data: data.data,
  });
};

export const response = { createSendResponse, getSendResponse };
