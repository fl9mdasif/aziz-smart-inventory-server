/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-unused-vars */
import { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import handleZodError from './handleZodError';
import config from '../config';
import handleValidationError from './handleValidationError';
import handleCastError from './handleCastError';
import handleDuplicateError from './handleDuplicateError';
import AppError from '../errors/AppErrors';

// global err handler middleware
// const globalErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
//   let statusCode = 500;
//   let message = 'Something went wrong!';

//   let errorSources: TErrorSources = [
//     {
//       path: '',
//       message: 'Something went wrong',
//     },
//   ];

//   if (err instanceof ZodError) {
//     const simplifiedErr = handleZodError(err);

//     statusCode = simplifiedErr?.statusCode;
//     message = simplifiedErr?.message;
//     errorSources = simplifiedErr?.errorSources;
//   } else if (err?.name === 'ValidationError') {
//     const simplifiedErr = handleValidationError(err);

//     statusCode = simplifiedErr?.statusCode;
//     message = simplifiedErr?.message;
//     errorSources = simplifiedErr?.errorSources;
//   } else if (err?.name === 'CastError') {
//     const simplifiedErr = handleCastError(err);

//     statusCode = simplifiedErr?.statusCode;
//     message = simplifiedErr?.message;
//     errorSources = simplifiedErr?.errorSources;
//   } else if (err?.code === 11000) {
//     const simplifiedErr = handleDuplicateError(err);

//     statusCode = simplifiedErr?.statusCode;
//     message = simplifiedErr?.message;
//     errorSources = simplifiedErr?.errorSources;
//   } else if (err instanceof AppError) {
//     statusCode = err?.statusCode;
//     message = err?.message;
//     errorSources = [
//       {
//         path: '',
//         message: err?.message,
//       },
//     ];
//   } else if (err instanceof Error) {
//     message = err?.message;
//     errorSources = [
//       {
//         path: '',
//         message: err?.message,
//       },
//     ];
//   }

//   // ultimate return from here
//   return res.status(statusCode).json({
//     success: false,
//     message,
//     errorSources,
//     err,
//     stack: config.NODE_ENV === 'development' ? err?.stack : null,
//   });
// };
const globalErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
  let statusCode = 500;
  let message = 'Something went wrong!';
  let errorMessage;

  if (err instanceof ZodError) {
    const simplifiedErr = handleZodError(err);

    statusCode = simplifiedErr?.statusCode;
    message = simplifiedErr?.message;
    errorMessage = simplifiedErr?.errorMessage;
  } else if (err?.name === 'ValidationError') {
    const simplifiedErr = handleValidationError(err);

    statusCode = simplifiedErr?.statusCode;
    message = simplifiedErr?.message;
  } else if (err?.name === 'CastError') {
    const simplifiedErr = handleCastError(err);

    statusCode = simplifiedErr?.statusCode;
    message = simplifiedErr?.message;
    errorMessage = simplifiedErr?.errorMessage;
  } else if (err?.code === 11000) {
    const simplifiedErr = handleDuplicateError(err);

    statusCode = simplifiedErr?.statusCode;
    message = simplifiedErr?.message;
  } else if (err instanceof AppError) {
    statusCode = err?.statusCode;
    message = err?.message;
  } else if (err instanceof Error) {
    message = err?.message;
  }

  // ultimate return from here
  return res.status(statusCode).json({
    success: false,
    message,
    errorMessage,
    errorDetails: err,
    stack: config.NODE_ENV === 'development' ? err?.stack : null,
  });
};

export default globalErrorHandler;
