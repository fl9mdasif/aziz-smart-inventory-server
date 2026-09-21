import { Activity } from './model.activity';
import { TActivity, TActivityType } from './interface.activity';

const createLog = async (payload: TActivity) => {
  const result = await Activity.create(payload);
  return result;
};

const getRecentActivities = async (query: Record<string, unknown> = {}) => {
  const { type, page = 1, limit = 10 } = query as {
    type?: TActivityType;
    page?: number | string;
    limit?: number | string;
  };

  const filter: Record<string, unknown> = {};
  if (type) filter.type = type;

  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 10;
  const skip = (pageNum - 1) * limitNum;

  const [activities, total] = await Promise.all([
    Activity.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('metadata.productId', 'name slug')
      .populate('metadata.orderId', 'customerName productName'),
    Activity.countDocuments(filter),
  ]);

  return {
    meta: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
    data: activities,
  };
};

export const ActivityService = {
  createLog,
  getRecentActivities,
};
