import mongoose, {
  type Document,
  Schema,
  type Types,
} from "mongoose";

export interface ITripActivity
  extends Document {
  trip: Types.ObjectId;
  creator: Types.ObjectId;
  activityDate: Date;
  startTime: string;
  endTime: string;
  title: string;
  location: string;
  description: string;
  estimatedCost: number;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const tripActivitySchema =
  new Schema<ITripActivity>(
    {
      trip: {
        type: Schema.Types.ObjectId,
        ref: "Trip",
        required: true,
        index: true,
      },

      creator: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      activityDate: {
        type: Date,
        required: [
          true,
          "Ngày hoạt động không được để trống",
        ],
        index: true,
      },

      startTime: {
        type: String,
        required: [
          true,
          "Giờ bắt đầu không được để trống",
        ],
        match: [
          /^([01]\d|2[0-3]):[0-5]\d$/,
          "Giờ bắt đầu không hợp lệ",
        ],
      },

      endTime: {
        type: String,
        default: "",
        validate: {
          validator: (value: string) => {
            return (
              value === "" ||
              /^([01]\d|2[0-3]):[0-5]\d$/.test(
                value
              )
            );
          },
          message: "Giờ kết thúc không hợp lệ",
        },
      },

      title: {
        type: String,
        required: [
          true,
          "Tên hoạt động không được để trống",
        ],
        trim: true,
        minlength: [
          2,
          "Tên hoạt động phải có ít nhất 2 ký tự",
        ],
        maxlength: [
          150,
          "Tên hoạt động không được vượt quá 150 ký tự",
        ],
      },

      location: {
        type: String,
        trim: true,
        maxlength: [
          200,
          "Địa điểm không được vượt quá 200 ký tự",
        ],
        default: "",
      },

      description: {
        type: String,
        trim: true,
        maxlength: [
          1000,
          "Mô tả không được vượt quá 1000 ký tự",
        ],
        default: "",
      },

      estimatedCost: {
        type: Number,
        min: [
          0,
          "Chi phí dự kiến không được nhỏ hơn 0",
        ],
        default: 0,
      },

      order: {
        type: Number,
        min: 0,
        default: 0,
      },

      isActive: {
        type: Boolean,
        default: true,
      },
    },
    {
      timestamps: true,
    }
  );

tripActivitySchema.index({
  trip: 1,
  activityDate: 1,
  startTime: 1,
  order: 1,
});

const TripActivity =
  mongoose.model<ITripActivity>(
    "TripActivity",
    tripActivitySchema
  );

export default TripActivity;