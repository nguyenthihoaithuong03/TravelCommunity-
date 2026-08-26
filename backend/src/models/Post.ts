import mongoose, {
  type Document,
  Schema,
  type Types,
} from "mongoose";

export type PostType =
  | "normal"
  | "companion_trip";

export interface IPost extends Document {
  author: Types.ObjectId;
  content: string;
  imageUrls: string[];
  location: string;
  likes: Types.ObjectId[];

  // Phân biệt bài thường và bài tìm bạn
  postType: PostType;

  // Liên kết chuyến đi nếu là bài tìm bạn
  trip: Types.ObjectId | null;

  isActive: boolean;
  sharesCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const postSchema = new Schema<IPost>(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    content: {
      type: String,
      required: [
        true,
        "Nội dung bài viết không được để trống",
      ],
      trim: true,
      maxlength: [
        2000,
        "Nội dung không được vượt quá 2000 ký tự",
      ],
    },

    imageUrls: {
      type: [String],
      default: [],
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

    likes: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    postType: {
      type: String,
      enum: [
        "normal",
        "companion_trip",
      ],
      default: "normal",
      index: true,
    },

    trip: {
      type: Schema.Types.ObjectId,
      ref: "Trip",
      default: null,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    sharesCount: {
      type: Number,
      default: 0,
      min: [
        0,
        "Số lượt chia sẻ không được nhỏ hơn 0",
      ],
    },
  },
  {
    timestamps: true,
  }
);

/*
 * Bài tìm bạn đồng hành bắt buộc
 * phải liên kết với một chuyến đi.
 */
postSchema.pre("validate", function () {
  if (
    this.postType === "companion_trip" &&
    !this.trip
  ) {
    this.invalidate(
      "trip",
      "Bài tìm bạn đồng hành phải liên kết với chuyến đi"
    );
  }

  /*
   * Bài viết bình thường không được liên kết
   * với dữ liệu chuyến đi.
   */
  if (
    this.postType === "normal" &&
    this.trip
  ) {
    this.invalidate(
      "trip",
      "Bài viết bình thường không được liên kết với chuyến đi"
    );
  }
});

/*
 * Mỗi chuyến đi chỉ có một bài tìm bạn
 * đồng hành trên bảng tin.
 *
 * Các bài thường có trip = null nên không
 * bị ảnh hưởng bởi chỉ mục này.
 */
postSchema.index(
  {
    trip: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      postType: "companion_trip",
      trip: {
        $type: "objectId",
      },
    },
  }
);

const Post = mongoose.model<IPost>(
  "Post",
  postSchema
);

export default Post;