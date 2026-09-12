import { Activity } from './model.activity';
import { TActivity } from './interface.activity';

const createLog = async (payload: TActivity) => {
  const result = await Activity.create(payload);
  return result;
};

const getRecentActivities = async (limit: number = 10) => {
  const result = await Activity.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('metadata.productId', 'name slug')
    .populate('metadata.orderId', 'customerName productName');
  return result;
};

export const ActivityService = {
  createLog,
  getRecentActivities,
};
