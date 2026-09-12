
// export default handleZodError;

import { ZodError } from 'zod';
import { TGenericErrorResponse } from '../interface/error';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleZodError = (err: ZodError<any>): TGenericErrorResponse => {
  const statusCode = 400;

  // get the required path form error response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const errorMessages = err.issues.map((issue: { path: any[] }) => {
    const pathNames = issue.path.map(String).join(', '); // Join path names with ', '

    return `${pathNames.slice(6)} is required`;
  });

  const formattedError = errorMessages.join('. ');

  return {
    statusCode,
    message: 'Validation Error',
    errorMessage: `${formattedError} `,
  };
};

export default handleZodError;
