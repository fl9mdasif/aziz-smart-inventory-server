
import { TGenericErrorResponse } from '../interface/error';

// eslint-disable-next-line @typescript-eslint/no-explicit-any, no-unused-vars
const handleDuplicateError = (err: any): TGenericErrorResponse => {
  const statusCode = 400;

  return {
    statusCode,
    message: 'Duplicate key value',
    errorMessage: err.message,
  };
};

export default handleDuplicateError;
