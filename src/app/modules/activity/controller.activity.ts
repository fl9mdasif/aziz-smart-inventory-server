import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import { ActivityService } from './service.activity';
import { response } from '../../utils/sendResponse';


const getRecentActivities = catchAsync(async (req: Request, res: Response) => {
  const result = await ActivityService.getRecentActivities();
  response.createSendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Recent activities retrieved successfully',
    data: result,
  });
});

export const ActivityController = {
  getRecentActivities,
};
