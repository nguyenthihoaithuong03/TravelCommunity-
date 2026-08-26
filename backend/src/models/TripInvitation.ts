import mongoose, {
  type Document,
  Schema,
  type Types,
} from "mongoose";

export type TripInvitationStatus =
  | "pending"
  | "accepted"
  | "rejected";

export type TripInvitationRequestType =
  | "invite"
  | "join_request";

export interface ITripInvitation
  extends Document {
  trip: Types.ObjectId;
  sender: Types.ObjectId;
  recipient: Types.ObjectId;
  requestType: TripInvitationRequestType;
  status: TripInvitationStatus;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

const tripInvitationSchema =
  new Schema<ITripInvitation>(
    {
      trip: {
        type: Schema.Types.ObjectId,
        ref: "Trip",
        required: true,
        index: true,
      },

      sender: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },

      recipient: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },

      requestType: {
        type: String,
        enum: ["invite", "join_request"],
        default: "invite",
        required: true,
        index: true,
      },

      status: {
        type: String,
        enum: [
          "pending",
          "accepted",
          "rejected",
        ],
        default: "pending",
        required: true,
      },

      message: {
        type: String,
        trim: true,
        maxlength: [
          300,
          "Lời nhắn không được vượt quá 300 ký tự",
        ],
        default: "",
      },
    },
    {
      timestamps: true,
    }
  );

/*
Không cho chủ chuyến đi gửi nhiều lời mời
đang chờ tới cùng một người.
*/
tripInvitationSchema.index(
  {
    trip: 1,
    recipient: 1,
    requestType: 1,
    status: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      requestType: "invite",
      status: "pending",
    },
  }
);

/*
Không cho một người gửi nhiều yêu cầu tham gia
đang chờ tới cùng một chuyến đi.
*/
tripInvitationSchema.index(
  {
    trip: 1,
    sender: 1,
    requestType: 1,
    status: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      requestType: "join_request",
      status: "pending",
    },
  }
);

const TripInvitation =
  mongoose.model<ITripInvitation>(
    "TripInvitation",
    tripInvitationSchema
  );

export default TripInvitation;