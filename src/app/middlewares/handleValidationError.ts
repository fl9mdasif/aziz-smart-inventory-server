
// export default handleValidationError;
import { TGenericErrorResponse } from '../interface/error';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleValidationError = (err: any): TGenericErrorResponse => {
  const statusCode = 400;
  // console.log(err);
  return {
    statusCode,
    message: 'Validation Error',
    // errorMessage: `${err.category.value} is not a valid ID`,
    errorDetails: err,
  };
};

export default handleValidationError;
