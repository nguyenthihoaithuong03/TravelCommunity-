import { Readable } from "node:stream";
import type { Response } from "express";

import cloudinary from "../config/cloudinary.js";
import type {
  AuthRequest,
} from "../middlewares/authMiddleware.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import mongoose from "mongoose";
import {
  getSocketIO,
} from "../config/socket.js";

interface UpdateProfileBody {
  fullName?: string;
  dateOfBirth?: string;
  gender?: "male" | "female" | "other" | "";
  hometown?: string;
  bio?: string;
  travelInterests?: string[];
  travelStyle?:
    | "relaxation"
    | "exploration"
    | "adventure"
    | "";
  budgetLevel?: "low" | "medium" | "high" | "";
  avatarUrl?: string;
}

// Lấy thông tin người dùng đang đăng nhập
export const getCurrentUser = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập",
      });
    }

    const user = await User.findById(userId).select(
      "-password"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error(
      "Lỗi lấy thông tin người dùng:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Không thể lấy thông tin người dùng",
    });
  }
};

// Cập nhật hồ sơ cá nhân
export const updateCurrentUser = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập",
      });
    }

    const {
      fullName,
      dateOfBirth,
      gender,
      hometown,
      bio,
      travelInterests,
      travelStyle,
      budgetLevel,
      avatarUrl,
    } = req.body as UpdateProfileBody;

    if (!fullName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Họ và tên không được để trống",
      });
    }

    if (fullName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Họ và tên phải có ít nhất 2 ký tự",
      });
    }

    if (bio && bio.trim().length > 500) {
      return res.status(400).json({
        success: false,
        message:
          "Giới thiệu không được vượt quá 500 ký tự",
      });
    }

    let parsedDateOfBirth: Date | null = null;

    if (dateOfBirth) {
      parsedDateOfBirth = new Date(dateOfBirth);

      if (Number.isNaN(parsedDateOfBirth.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Ngày sinh không hợp lệ",
        });
      }

      if (parsedDateOfBirth > new Date()) {
        return res.status(400).json({
          success: false,
          message:
            "Ngày sinh không được lớn hơn ngày hiện tại",
        });
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        fullName: fullName.trim(),
        dateOfBirth: parsedDateOfBirth,
        gender: gender || null,
        hometown: hometown?.trim() || "",
        bio: bio?.trim() || "",
        travelInterests: Array.isArray(
          travelInterests
        )
          ? travelInterests
          : [],
        travelStyle: travelStyle || null,
        budgetLevel: budgetLevel || null,
        avatarUrl: avatarUrl?.trim() || "",
      },
      {
        new: true,
        runValidators: true,
      }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Cập nhật hồ sơ thành công",
      user,
    });
  } catch (error) {
    console.error("Lỗi cập nhật hồ sơ:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể cập nhật hồ sơ",
    });
  }
};

// Tải ảnh đại diện từ máy lên Cloudinary
export const uploadAvatar = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập",
      });
    }

   if (!req.file) {
  return res.status(400).json({
    success: false,
    message: "Bạn chưa chọn ảnh đại diện",
  });
}

const avatarFile = req.file;
    const uploadResult = await new Promise<{
      secureUrl: string;
      publicId: string;
    }>((resolve, reject) => {
      const uploadStream =
        cloudinary.uploader.upload_stream(
          {
            folder: "travel-community/avatars",
            resource_type: "image",
            transformation: [
              {
                width: 500,
                height: 500,
                crop: "fill",
                gravity: "face",
              },
              {
                quality: "auto",
                fetch_format: "auto",
              },
            ],
          },
          (error, result) => {
            if (error) {
              reject(error);
              return;
            }

            if (!result) {
              reject(
                new Error(
                  "Cloudinary không trả về kết quả"
                )
              );
              return;
            }

            resolve({
              secureUrl: result.secure_url,
              publicId: result.public_id,
            });
          }
        );

      Readable.from(avatarFile.buffer).pipe(
        uploadStream
      );
    });

    const user = await User.findByIdAndUpdate(
      userId,
      {
        avatarUrl: uploadResult.secureUrl,
      },
      {
        new: true,
        runValidators: true,
      }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Cập nhật ảnh đại diện thành công",
      avatarUrl: uploadResult.secureUrl,
      user,
    });
  } catch (error) {
    console.error(
      "Lỗi tải ảnh đại diện:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Không thể tải ảnh đại diện",
    });
  }
};
// Lấy hồ sơ công khai của một người dùng
export const getUserProfile = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const currentUserId = req.user?.userId;

    const userIdParam = req.params.userId;

    const userId = Array.isArray(userIdParam)
      ? userIdParam[0]
      : userIdParam;

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập",
      });
    }

    if (
      !userId ||
      !mongoose.isValidObjectId(userId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Mã người dùng không hợp lệ",
      });
    }

    const user = await User.findOne({
      _id: userId,
      isActive: true,
    }).select(
      "fullName avatarUrl bio hometown " +
        "travelInterests travelStyle " +
        "followers following createdAt"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
      });
    }

    const followers = user.followers ?? [];
    const following = user.following ?? [];

    const isFollowing = followers.some(
      (followerId) =>
        followerId.toString() === currentUserId
    );

    return res.status(200).json({
      success: true,
      user: {
        ...user.toObject(),
        followersCount: followers.length,
        followingCount: following.length,
        isFollowing,
      },
    });
  } catch (error) {
    console.error(
      "Lỗi lấy hồ sơ người dùng:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Không thể lấy hồ sơ người dùng",
    });
  }
};
// Theo dõi hoặc bỏ theo dõi người dùng
export const toggleFollowUser = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const currentUserId = req.user?.userId;

    const targetUserIdParam =
      req.params.userId;

    const targetUserId = Array.isArray(
      targetUserIdParam
    )
      ? targetUserIdParam[0]
      : targetUserIdParam;

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập",
      });
    }

    if (
      !targetUserId ||
      !mongoose.isValidObjectId(targetUserId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Mã người dùng không hợp lệ",
      });
    }

    if (currentUserId === targetUserId) {
      return res.status(400).json({
        success: false,
        message:
          "Bạn không thể tự theo dõi chính mình",
      });
    }

    const [currentUser, targetUser] =
      await Promise.all([
        User.findOne({
          _id: currentUserId,
          isActive: true,
        }),
        User.findOne({
          _id: targetUserId,
          isActive: true,
        }),
      ]);

    if (!currentUser || !targetUser) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
      });
    }

    const isFollowing = (
      currentUser.following ?? []
    ).some(
      (followingId) =>
        followingId.toString() === targetUserId
    );

    if (isFollowing) {
      // Bỏ theo dõi và xóa thông báo cũ.
      await Promise.all([
        User.updateOne(
          { _id: currentUserId },
          {
            $pull: {
              following: targetUserId,
            },
          }
        ),

        User.updateOne(
          { _id: targetUserId },
          {
            $pull: {
              followers: currentUserId,
            },
          }
        ),

        Notification.deleteMany({
          recipient: targetUserId,
          sender: currentUserId,
          type: "follow",
        }),
      ]);
    } else {
      // Cập nhật danh sách theo dõi của hai tài khoản.
      await Promise.all([
        User.updateOne(
          { _id: currentUserId },
          {
            $addToSet: {
              following: targetUserId,
            },
          }
        ),

        User.updateOne(
          { _id: targetUserId },
          {
            $addToSet: {
              followers: currentUserId,
            },
          }
        ),
      ]);

      // Tạo thông báo và gửi ngay qua Socket.IO.
      const notification =
        await Notification.create({
          recipient: targetUserId,
          sender: currentUserId,
          type: "follow",
          message:
            `${currentUser.fullName} ` +
            "đã bắt đầu theo dõi bạn",
        });

      getSocketIO()
        ?.to(`user:${targetUserId}`)
        .emit("new-notification", {
          notification,
        });
    }

    const updatedTargetUser =
      await User.findById(targetUserId).select(
        "followers following"
      );

    return res.status(200).json({
      success: true,
      message: isFollowing
        ? "Đã bỏ theo dõi"
        : "Đã theo dõi",
      isFollowing: !isFollowing,
      followersCount:
        updatedTargetUser?.followers?.length ?? 0,
    });
  } catch (error) {
    console.error(
      "Lỗi theo dõi người dùng:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Không thể thực hiện theo dõi",
    });
  }
};
// Lấy danh sách người theo dõi và đang theo dõi
export const getUserConnections = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userIdParam = req.params.userId;

    const userId = Array.isArray(userIdParam)
      ? userIdParam[0]
      : userIdParam;

    if (
      !userId ||
      !mongoose.isValidObjectId(userId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Mã người dùng không hợp lệ",
      });
    }

    const user = await User.findOne({
      _id: userId,
      isActive: true,
    })
      .select("followers following")
      .populate(
        "followers",
        "fullName avatarUrl bio hometown"
      )
      .populate(
        "following",
        "fullName avatarUrl bio hometown"
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
      });
    }

    return res.status(200).json({
      success: true,
      followers: user.followers,
      following: user.following,
    });
  } catch (error) {
    console.error(
      "Lỗi lấy danh sách theo dõi:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Không thể lấy danh sách theo dõi",
    });
  }
};
// Tìm người dùng để mời tham gia chuyến đi
export const searchUsers = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const currentUserId = req.user?.userId;

    const keywordValue = req.query.keyword;

    const keyword = Array.isArray(keywordValue)
      ? String(keywordValue[0] || "").trim()
      : String(keywordValue || "").trim();

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập",
      });
    }

    if (keyword.length < 2) {
      return res.status(200).json({
        success: true,
        users: [],
      });
    }

    const escapedKeyword = keyword.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    const users = await User.find({
      _id: {
        $ne: new mongoose.Types.ObjectId(
          currentUserId
        ),
      },
      isActive: true,
      $or: [
        {
          fullName: {
            $regex: escapedKeyword,
            $options: "i",
          },
        },
        {
          email: {
            $regex: escapedKeyword,
            $options: "i",
          },
        },
      ],
    })
      .select(
        "_id fullName email avatarUrl hometown"
      )
      .limit(10);

    return res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    console.error(
      "Lỗi tìm kiếm người dùng:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Không thể tìm kiếm người dùng",
    });
  }
};