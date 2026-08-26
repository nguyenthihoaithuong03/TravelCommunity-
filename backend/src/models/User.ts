import mongoose, {
  type Document,
  Schema,
  type Types,
} from "mongoose";

export interface IFavoriteDestination {
  name: string;
  address: string;
  imageUrl: string;
  latitude: number | null;
  longitude: number | null;
  savedAt: Date;
}

export interface IUser extends Document {
  fullName: string;
  email: string;
  password: string;
  role: "user" | "admin";
  avatarUrl: string;
  isActive: boolean;

  dateOfBirth?: Date;
  gender?: "male" | "female" | "other";
  hometown?: string;
  bio?: string;

  travelInterests: string[];

  travelStyle?:
    | "relaxation"
    | "exploration"
    | "adventure";

  budgetLevel?:
    | "low"
    | "medium"
    | "high";

  followers: Types.ObjectId[];
  following: Types.ObjectId[];

  favoriteDestinations: IFavoriteDestination[];

  createdAt: Date;
  updatedAt: Date;
}

const favoriteDestinationSchema =
  new Schema<IFavoriteDestination>(
    {
      name: {
        type: String,
        required: [
          true,
          "Tên địa điểm không được để trống",
        ],
        trim: true,
        maxlength: [
          200,
          "Tên địa điểm không được vượt quá 200 ký tự",
        ],
      },

      address: {
        type: String,
        trim: true,
        maxlength: [
          500,
          "Địa chỉ không được vượt quá 500 ký tự",
        ],
        default: "",
      },

      imageUrl: {
        type: String,
        trim: true,
        default: "",
      },

      latitude: {
        type: Number,
        min: [
          -90,
          "Vĩ độ không hợp lệ",
        ],
        max: [
          90,
          "Vĩ độ không hợp lệ",
        ],
        default: null,
      },

      longitude: {
        type: Number,
        min: [
          -180,
          "Kinh độ không hợp lệ",
        ],
        max: [
          180,
          "Kinh độ không hợp lệ",
        ],
        default: null,
      },

      savedAt: {
        type: Date,
        default: Date.now,
      },
    },
    {
      _id: false,
    }
  );

const userSchema = new Schema<IUser>(
  {
    fullName: {
      type: String,
      required: [
        true,
        "Họ tên không được để trống",
      ],
      trim: true,
      minlength: [
        2,
        "Họ tên phải có ít nhất 2 ký tự",
      ],
      maxlength: [
        100,
        "Họ tên không được vượt quá 100 ký tự",
      ],
    },

    email: {
      type: String,
      required: [
        true,
        "Email không được để trống",
      ],
      unique: true,
      trim: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: [
        true,
        "Mật khẩu không được để trống",
      ],
      minlength: [
        6,
        "Mật khẩu phải có ít nhất 6 ký tự",
      ],
    },

    role: {
      type: String,
      enum: [
        "user",
        "admin",
      ],
      default: "user",
    },

    avatarUrl: {
      type: String,
      default: "",
    },

    followers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    following: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    isActive: {
      type: Boolean,
      default: true,
    },

    dateOfBirth: {
      type: Date,
      default: null,
    },

    gender: {
      type: String,
      enum: [
        "male",
        "female",
        "other",
      ],
      default: null,
    },

    hometown: {
      type: String,
      trim: true,
      maxlength: [
        100,
        "Quê quán không được vượt quá 100 ký tự",
      ],
      default: "",
    },

    bio: {
      type: String,
      trim: true,
      maxlength: [
        500,
        "Giới thiệu không được vượt quá 500 ký tự",
      ],
      default: "",
    },

    travelInterests: {
      type: [String],
      default: [],
    },

    travelStyle: {
      type: String,
      enum: [
        "relaxation",
        "exploration",
        "adventure",
      ],
      default: null,
    },

    budgetLevel: {
      type: String,
      enum: [
        "low",
        "medium",
        "high",
      ],
      default: null,
    },

    favoriteDestinations: {
      type: [
        favoriteDestinationSchema,
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model<IUser>(
  "User",
  userSchema
);

export default User;