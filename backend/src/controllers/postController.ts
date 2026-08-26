import { Readable } from "node:stream";
import type { Response } from "express";
import mongoose from "mongoose";

import cloudinary from "../config/cloudinary.js";
import type { AuthRequest } from "../middlewares/authMiddleware.js";
import Comment from "../models/Comment.js";
import Post from "../models/Post.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import {
  getSocketIO,
} from "../config/socket.js";

interface CreatePostBody {
  content?: string;
  location?: string;
}

const getRouteParam = (
  value: string | string[] | undefined
): string | undefined => {
  return Array.isArray(value) ? value[0] : value;
};

const uploadPostImage = (
  file: Express.Multer.File
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "travel-community/posts",
        resource_type: "image",
        transformation: [
          {
            width: 1400,
            height: 1400,
            crop: "limit",
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
            new Error("Cloudinary không trả về kết quả")
          );
          return;
        }

        resolve(result.secure_url);
      }
    );

    Readable.from(file.buffer).pipe(uploadStream);
  });
};

// Tạo bài viết
export const createPost = async (
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

    const { content, location } =
      req.body as CreatePostBody;

    if (!content?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Nội dung bài viết không được để trống",
      });
    }

    if (content.trim().length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Nội dung không được vượt quá 2000 ký tự",
      });
    }

    const imageFiles = Array.isArray(req.files)
      ? req.files
      : [];

    const imageUrls = await Promise.all(
      imageFiles.map((file) => uploadPostImage(file))
    );

    const post = await Post.create({
      author: userId,
      content: content.trim(),
      location: location?.trim() || "",
      imageUrls,
      postType: "normal",
      trip: null,
    });

    await post.populate(
      "author",
      "fullName email avatarUrl"
    );

    return res.status(201).json({
      success: true,
      message: "Đăng bài thành công",
      post: {
        ...post.toObject(),
        commentsCount: 0,
      },
    });
  } catch (error) {
    console.error("Lỗi tạo bài viết:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể tạo bài viết",
    });
  }
};

// Lấy danh sách bài viết kèm tổng số bình luận
export const getPosts = async (
  _req: AuthRequest,
  res: Response
) => {
  try {
    const posts = await Post.find({
      isActive: true,
    })
      .populate("author", "fullName email avatarUrl")
      .populate({
        path: "trip",
        select:
          "title destination description startDate endDate budget coverImageUrl members status visibility isLookingForCompanions maxMembers",
        populate: [
          {
            path: "owner",
            select: "fullName avatarUrl",
          },
          {
            path: "members",
            select: "fullName avatarUrl",
          },
        ],
      })
      .sort({ createdAt: -1 });

    const postsWithCommentsCount = await Promise.all(
      posts.map(async (post) => {
        const commentsCount = await Comment.countDocuments({
          post: post._id,
          isActive: true,
        });

        return {
          ...post.toObject(),
          commentsCount,
        };
      })
    );

    return res.status(200).json({
      success: true,
      posts: postsWithCommentsCount,
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách bài viết:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách bài viết",
    });
  }
};

// Sửa bài viết
export const updatePost = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;
    const postId = getRouteParam(req.params.postId);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập",
      });
    }

    if (!postId || !mongoose.isValidObjectId(postId)) {
      return res.status(400).json({
        success: false,
        message: "Mã bài viết không hợp lệ",
      });
    }

    const { content, location } =
      req.body as CreatePostBody;

    if (!content?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Nội dung bài viết không được để trống",
      });
    }

    if (content.trim().length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Nội dung không được vượt quá 2000 ký tự",
      });
    }

    const post = await Post.findOneAndUpdate(
      {
        _id: postId,
        author: userId,
        isActive: true,
      },
      {
        content: content.trim(),
        location: location?.trim() || "",
      },
      {
        new: true,
        runValidators: true,
      }
    ).populate("author", "fullName email avatarUrl");

    if (!post) {
      return res.status(404).json({
        success: false,
        message:
          "Không tìm thấy bài viết hoặc bạn không có quyền sửa",
      });
    }

    const commentsCount = await Comment.countDocuments({
      post: post._id,
      isActive: true,
    });

    return res.status(200).json({
      success: true,
      message: "Cập nhật bài viết thành công",
      post: {
        ...post.toObject(),
        commentsCount,
      },
    });
  } catch (error) {
    console.error("Lỗi sửa bài viết:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể cập nhật bài viết",
    });
  }
};

// Xóa bài viết
export const deletePost = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;
    const postId = getRouteParam(req.params.postId);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập",
      });
    }

    if (!postId || !mongoose.isValidObjectId(postId)) {
      return res.status(400).json({
        success: false,
        message: "Mã bài viết không hợp lệ",
      });
    }

    const post = await Post.findOneAndUpdate(
      {
        _id: postId,
        author: userId,
        isActive: true,
      },
      { isActive: false },
      { new: true }
    );

    if (!post) {
      return res.status(404).json({
        success: false,
        message:
          "Không tìm thấy bài viết hoặc bạn không có quyền xóa",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Xóa bài viết thành công",
    });
  } catch (error) {
    console.error("Lỗi xóa bài viết:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể xóa bài viết",
    });
  }
};

// Thích hoặc bỏ thích bài viết
export const toggleLikePost = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;
    const postId = getRouteParam(req.params.postId);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập",
      });
    }

    if (!postId || !mongoose.isValidObjectId(postId)) {
      return res.status(400).json({
        success: false,
        message: "Mã bài viết không hợp lệ",
      });
    }

    const post = await Post.findOne({
      _id: postId,
      isActive: true,
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bài viết",
      });
    }

    const hasLiked = post.likes.some(
      (likedUserId) => likedUserId.toString() === userId
    );

    if (hasLiked) {
      post.likes = post.likes.filter(
        (likedUserId) =>
          likedUserId.toString() !== userId
      );
    } else {
      post.likes.push(
        new mongoose.Types.ObjectId(userId)
      );
    }

    await post.save();

    // Chỉ xử lý thông báo khi người thao tác
    // không phải là chủ bài viết.
    if (post.author.toString() !== userId) {
      if (hasLiked) {
        // Bỏ thích: xóa thông báo tương ứng.
        await Notification.deleteMany({
          recipient: post.author,
          sender: userId,
          type: "like_post",
          post: post._id,
        });
      } else {
        // Thích: tạo thông báo và phát ngay
        // tới chủ bài viết qua Socket.IO.
        const currentUser =
          await User.findById(userId).select(
            "fullName"
          );

        const notification =
          await Notification.create({
            recipient: post.author,
            sender: userId,
            type: "like_post",
            post: post._id,
            message:
              `${
                currentUser?.fullName ||
                "Một người dùng"
              } đã thích bài viết của bạn`,
          });

        getSocketIO()
          ?.to(
            `user:${post.author.toString()}`
          )
          .emit("new-notification", {
            notification,
          });
      }
    }

    return res.status(200).json({
      success: true,
      message: hasLiked
        ? "Đã bỏ thích bài viết"
        : "Đã thích bài viết",
      isLiked: !hasLiked,
      likesCount: post.likes.length,
      likes: post.likes,
    });
  } catch (error) {
    console.error("Lỗi thích bài viết:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể thích bài viết",
    });
  }
};
// Tăng số lượt chia sẻ bài viết
export const sharePost = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;

    const postIdParam = req.params.postId;

    const postId = Array.isArray(postIdParam)
      ? postIdParam[0]
      : postIdParam;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập",
      });
    }

    if (
      !postId ||
      !mongoose.isValidObjectId(postId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Mã bài viết không hợp lệ",
      });
    }

    const post = await Post.findOneAndUpdate(
      {
        _id: postId,
        isActive: true,
      },
      {
        $inc: {
          sharesCount: 1,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    ).select("sharesCount");

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bài viết",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Đã ghi nhận lượt chia sẻ",
      sharesCount: post.sharesCount,
    });
  } catch (error) {
    console.error(
      "Lỗi ghi nhận lượt chia sẻ:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Không thể ghi nhận lượt chia sẻ",
    });
  }
};
// Lấy các bài viết của một người dùng
export const getUserPosts = async (
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

    const posts = await Post.find({
      author: userId,
      isActive: true,
    })
      .populate(
        "author",
        "fullName email avatarUrl"
      )
      .populate({
        path: "trip",
        select:
          "title destination description startDate endDate budget coverImageUrl members status visibility isLookingForCompanions maxMembers",
        populate: [
          {
            path: "owner",
            select: "fullName avatarUrl",
          },
          {
            path: "members",
            select: "fullName avatarUrl",
          },
        ],
      })
      .sort({ createdAt: -1 });

    const postsWithCommentsCount =
      await Promise.all(
        posts.map(async (post) => {
          const commentsCount =
            await Comment.countDocuments({
              post: post._id,
              isActive: true,
            });

          return {
            ...post.toObject(),
            commentsCount,
          };
        })
      );

    return res.status(200).json({
      success: true,
      posts: postsWithCommentsCount,
    });
  } catch (error) {
    console.error(
      "Lỗi lấy bài viết người dùng:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Không thể lấy bài viết của người dùng",
    });
  }
};