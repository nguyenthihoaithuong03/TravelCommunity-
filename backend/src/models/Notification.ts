import mongoose, {
  type Document,
  Schema,
  type Types,
} from "mongoose";

export type NotificationType =
  | "follow"
  | "like_post"
  | "comment"
  | "reply"
  | "trip_invite"
  | "trip_join_request"
  | "trip_invite_accepted"
  | "trip_invite_rejected"
  | "trip_invite_cancelled"
  | "trip_join_accepted"
  | "trip_join_rejected"
  | "trip_join_cancelled";

export interface INotification extends Document {
  recipient: Types.ObjectId;
  sender: Types.ObjectId;
  type: NotificationType;
  post: Types.ObjectId | null;
  comment: Types.ObjectId | null;
  trip: Types.ObjectId | null;
  message: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationTypes: NotificationType[] = [
  "follow",
  "like_post",
  "comment",
  "reply",
  "trip_invite",
  "trip_join_request",
  "trip_invite_accepted",
  "trip_invite_rejected",
  "trip_invite_cancelled",
  "trip_join_accepted",
  "trip_join_rejected",
  "trip_join_cancelled",
];

const notificationSchema = new Schema<INotification>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: notificationTypes,
      required: true,
    },
    post: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },
    comment: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    trip: {
      type: Schema.Types.ObjectId,
      ref: "Trip",
      default: null,
      index: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

notificationSchema.index({
  recipient: 1,
  createdAt: -1,
});

const Notification = mongoose.model<INotification>(
  "Notification",
  notificationSchema
);

export default Notification;