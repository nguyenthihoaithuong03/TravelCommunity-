import mongoose, {
  type Document,
  Schema,
  type Types,
} from "mongoose";

export type TripStatus =
  | "planning"
  | "ongoing"
  | "completed"
  | "cancelled";

export type TripVisibility =
  | "private"
  | "public";

export interface ITrip extends Document {
  owner: Types.ObjectId;
  title: string;
  destination: string;
  description: string;
  startDate: Date;
  endDate: Date;
  budget: number;
  coverImageUrl: string;
  members: Types.ObjectId[];
  status: TripStatus;

  // Quyền hiển thị chuyến đi
  visibility: TripVisibility;

  // Có đang tìm bạn đồng hành hay không
  isLookingForCompanions: boolean;

  // Tổng số người tối đa, gồm cả chủ chuyến đi
  maxMembers: number;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const tripSchema = new Schema<ITrip>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: [
        true,
        "Tên chuyến đi không được để trống",
      ],
      trim: true,
      minlength: [
        2,
        "Tên chuyến đi phải có ít nhất 2 ký tự",
      ],
      maxlength: [
        150,
        "Tên chuyến đi không được vượt quá 150 ký tự",
      ],
    },

    destination: {
      type: String,
      required: [
        true,
        "Điểm đến không được để trống",
      ],
      trim: true,
      maxlength: [
        200,
        "Điểm đến không được vượt quá 200 ký tự",
      ],
      index: true,
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

    startDate: {
      type: Date,
      required: [
        true,
        "Ngày bắt đầu không được để trống",
      ],
      index: true,
    },

    endDate: {
      type: Date,
      required: [
        true,
        "Ngày kết thúc không được để trống",
      ],
    },

    budget: {
      type: Number,
      min: [
        0,
        "Ngân sách không được nhỏ hơn 0",
      ],
      default: 0,
    },

    coverImageUrl: {
      type: String,
      default: "",
    },

    members: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    status: {
      type: String,
      enum: [
        "planning",
        "ongoing",
        "completed",
        "cancelled",
      ],
      default: "planning",
      index: true,
    },

    visibility: {
      type: String,
      enum: ["private", "public"],
      default: "private",
      index: true,
    },

    isLookingForCompanions: {
      type: Boolean,
      default: false,
      index: true,
    },

    maxMembers: {
      type: Number,
      min: [
        2,
        "Chuyến đi phải cho phép ít nhất 2 người",
      ],
      max: [
        100,
        "Chuyến đi không được vượt quá 100 người",
      ],
      default: 4,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Kiểm tra ngày bắt đầu và kết thúc
tripSchema.pre("validate", function () {
  if (
    this.startDate &&
    this.endDate &&
    this.endDate < this.startDate
  ) {
    this.invalidate(
      "endDate",
      "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu"
    );
  }

  /*
   * Muốn tìm bạn đồng hành thì chuyến đi
   * bắt buộc phải được công khai.
   */
  if (
    this.isLookingForCompanions &&
    this.visibility !== "public"
  ) {
    this.invalidate(
      "visibility",
      "Chuyến đi phải công khai khi tìm bạn đồng hành"
    );
  }

  /*
   * Tổng người hiện tại gồm:
   * 1 chủ chuyến đi + số thành viên.
   */
  const currentMemberCount =
    1 + this.members.length;

  if (currentMemberCount > this.maxMembers) {
    this.invalidate(
      "maxMembers",
      "Số người tối đa không được nhỏ hơn số thành viên hiện tại"
    );
  }
});

// Hỗ trợ truy vấn chuyến đi đang tìm bạn
tripSchema.index({
  visibility: 1,
  isLookingForCompanions: 1,
  isActive: 1,
  startDate: 1,
});

const Trip = mongoose.model<ITrip>(
  "Trip",
  tripSchema
);

export default Trip;