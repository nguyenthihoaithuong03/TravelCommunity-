import mongoose, {
  type Document,
  Schema,
  type Types,
} from "mongoose";

export interface IComment extends Document {
  post: Types.ObjectId;
  author: Types.ObjectId;

  // Nếu null: bình luận gốc
  // Nếu có giá trị: câu trả lời bình luận
  parentComment: Types.ObjectId | null;

  content: string;
  imageUrl: string;
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
  likes: Types.ObjectId[];
}

const commentSchema = new Schema<IComment>(
  {
    post: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },

    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    parentComment: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
      index: true,
    },

    content: {
      type: String,
      trim: true,
      maxlength: [
        500,
        "Bình luận không được vượt quá 500 ký tự",
      ],
      default: "",
    },

    imageUrl: {
      type: String,
      default: "",
    },
    likes: [
  {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
],

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Comment = mongoose.model<IComment>(
  "Comment",
  commentSchema
);

export default Comment;