import { Schema, model } from 'mongoose';
import { TActivity } from './interface.activity';

const activitySchema = new Schema<TActivity>(
  {
    type: {
      type: String,
      enum: ['order', 'product', 'user', 'system'],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    metadata: {
      orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
      productId: { type: Schema.Types.ObjectId, ref: 'Product' },
      additionalInfo: { type: String },
    },
  },
  {
    timestamps: true,
  },
);

export const Activity = model<TActivity>('Activity', activitySchema);
