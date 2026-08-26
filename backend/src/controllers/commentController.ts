import { Readable } from "node:stream";
import type { Response } from "express";
import mongoose from "mongoose";

import cloudinary from "../config/cloudinary.js";
import type {
  AuthRequest,
} from "../middlewares/authMiddleware.js";
import Comment from "../models/Comment.js";
import Post from "../models/Post.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import {
  getSocketIO,
} from "../config/socket.js";

// Xử lý tham số URL của Express
const getRouteParam = (
  value: string | string[] | undefined
): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

// Tải ảnh bình luận lên Cloudinary
const uploadCommentImage = (
  file: Express.Multer.File
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream =
      cloudinary.uploader.upload_stream(
        {
          folder:
            "travel-community/comments",

          resource_type: "image",

          transformation: [
            {
              width: 1200,
              height: 1200,
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
              new Error(
                "Cloudinary không trả về kết quả"
              )
            );
            return;
          }

          resolve(result.secure_url);
        }
      );

    Readable.from(file.buffer).pipe(
      uploadStream
    );
  });
};

// Lấy danh sách bình luận của bài viết
export const getPostComments = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const postId = getRouteParam(
      req.params.postId
    );

    if (
      !postId ||
      !mongoose.isValidObjectId(postId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Mã bài viết không hợp lệ",
      });
    }

    const postObjectId =
      new mongoose.Types.ObjectId(postId);

    const post = await Post.findOne({
      _id: postObjectId,
      isActive: true,
    }).select("author");

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bài viết",
      });
    }

    const comments = await Comment.find({
      post: postObjectId,
      isActive: true,
    })
      .populate(
        "author",
        "fullName email avatarUrl"
      )
      .sort({
        createdAt: 1,
      });

    return res.status(200).json({
      success: true,
      comments,
    });
  } catch (error) {
    console.error(
      "Lỗi lấy danh sách bình luận:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Không thể lấy bình luận",
    });
  }
};

// Tạo bình luận hoặc trả lời bình luận
export const createComment = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;

    const postId = getRouteParam(
      req.params.postId
    );

    const content =
      typeof req.body.content === "string"
        ? req.body.content.trim()
        : "";
        
    const parentCommentId =
      typeof req.body.parentCommentId ===
      "string"
        ? req.body.parentCommentId.trim()
        : "";

    const imageFile = req.file;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập",
      });
    }

    if (
      !mongoose.isValidObjectId(userId)
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Thông tin đăng nhập không hợp lệ",
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

    // Cho phép gửi chữ, ảnh hoặc cả hai
    if (!content && !imageFile) {
      return res.status(400).json({
        success: false,
        message:
          "Bạn cần nhập nội dung hoặc chọn một ảnh",
      });
    }

    if (content.length > 500) {
      return res.status(400).json({
        success: false,
        message:
          "Bình luận không được vượt quá 500 ký tự",
      });
    }

    const userObjectId =
      new mongoose.Types.ObjectId(userId);

    const postObjectId =
      new mongoose.Types.ObjectId(postId);

    const post = await Post.findOne({
      _id: postObjectId,
      isActive: true,
    }).select("author");

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bài viết",
      });
    }

    let parentCommentObjectId:
      | mongoose.Types.ObjectId
      | null = null;

    let parentCommentAuthor:
      | mongoose.Types.ObjectId
      | null = null;

    // Nếu đây là một câu trả lời
    if (parentCommentId) {
      if (
        !mongoose.isValidObjectId(
          parentCommentId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Mã bình luận được trả lời không hợp lệ",
        });
      }

      parentCommentObjectId =
        new mongoose.Types.ObjectId(
          parentCommentId
        );

      const parentComment = await Comment.findOne({
          _id: parentCommentObjectId,
          post: postObjectId,
          isActive: true,
        }).select("author");

      if (!parentComment) {
        return res.status(404).json({
          success: false,
          message:
            "Không tìm thấy bình luận được trả lời",
        });
      }

      parentCommentAuthor =
        parentComment.author;
    }

    // Có ảnh thì tải lên Cloudinary
    const imageUrl = imageFile
      ? await uploadCommentImage(imageFile)
      : "";

    const comment = new Comment({
      post: postObjectId,
      author: userObjectId,
      parentComment:
        parentCommentObjectId,
      content,
      imageUrl,
    });

    await comment.save();

    await comment.populate(
      "author",
      "fullName email avatarUrl"
    );

    /*
     * Trả lời: thông báo cho chủ bình luận.
     * Bình luận gốc: thông báo cho chủ bài viết.
     */
    const notificationType:
      | "comment"
      | "reply" = parentCommentAuthor
      ? "reply"
      : "comment";

    const notificationRecipient =
      parentCommentAuthor
        ? parentCommentAuthor.toString()
        : post.author.toString();

    // Không tự gửi thông báo cho chính mình.
    if (notificationRecipient !== userId) {
      try {
        const currentUser =
          await User.findById(userObjectId).select(
            "fullName"
          );

        const senderName =
          currentUser?.fullName ||
          "Một người dùng";

        const notification =
       await Notification.create({
          recipient: new mongoose.Types.ObjectId(
          notificationRecipient
        ),
        sender: userObjectId,
        type: notificationType,
        post: postObjectId,
        comment: comment._id,
         message:
      notificationType === "reply"
        ? `${senderName} đã trả lời bình luận của bạn`
        : `${senderName} đã bình luận bài viết của bạn`,
         });

        getSocketIO()
        ?.to(`user:${notificationRecipient}`)
        .emit("new-notification", {
          notification,
         });
      } catch (notificationError) {
        // Không làm hỏng bình luận nếu riêng thông báo bị lỗi.
        console.error(
          "Lỗi tạo thông báo bình luận:",
          notificationError
        );
      }

    }

    return res.status(201).json({
      success: true,
      message: parentCommentObjectId
        ? "Trả lời bình luận thành công"
        : "Bình luận thành công",
      comment,
    });
  } catch (error) {
    console.error(
      "Lỗi tạo bình luận:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Không thể gửi bình luận",
    });
  }
};

// Xóa bình luận hoặc câu trả lời của chính mình
export const deleteComment = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;

    const commentId = getRouteParam(
      req.params.commentId
    );

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập",
      });
    }

    if (
      !mongoose.isValidObjectId(userId)
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Thông tin đăng nhập không hợp lệ",
      });
    }

    if (
      !commentId ||
      !mongoose.isValidObjectId(commentId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Mã bình luận không hợp lệ",
      });
    }

    const userObjectId =
      new mongoose.Types.ObjectId(userId);

    const commentObjectId =
      new mongoose.Types.ObjectId(commentId);

    const comment =
      await Comment.findOneAndUpdate(
        {
          _id: commentObjectId,
          author: userObjectId,
          isActive: true,
        },
        {
          isActive: false,
        },
        {
          new: true,
        }
      );

    if (!comment) {
      return res.status(404).json({
        success: false,
        message:
          "Không tìm thấy bình luận hoặc bạn không có quyền xóa",
      });
    }

    /*
     * Nếu xóa bình luận gốc, ẩn luôn
     * những câu trả lời của bình luận đó.
     */
    if (!comment.parentComment) {
      const replies = await Comment.find({
        parentComment: commentObjectId,
      }).select("_id");

      const replyIds = replies.map(
        (reply) => reply._id
      );

      await Comment.updateMany(
        {
          parentComment: commentObjectId,
          isActive: true,
        },
        {
          isActive: false,
        }
      );

      await Notification.deleteMany({
        $or: [
          { comment: commentObjectId },
          { comment: { $in: replyIds } },
        ],
      });
    } else {
      await Notification.deleteMany({
        comment: commentObjectId,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Xóa bình luận thành công",
    });
  } catch (error) {
    console.error(
      "Lỗi xóa bình luận:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Không thể xóa bình luận",
    });
  }
};
// Thích hoặc bỏ thích bình luận
export const toggleLikeComment = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;

    const commentIdParam =
      req.params.commentId;

    const commentId = Array.isArray(
      commentIdParam
    )
      ? commentIdParam[0]
      : commentIdParam;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập",
      });
    }

    if (
      !commentId ||
      !mongoose.isValidObjectId(commentId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Mã bình luận không hợp lệ",
      });
    }

    const comment = await Comment.findOne({
      _id: commentId,
      isActive: true,
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bình luận",
      });
    }

    // Hỗ trợ cả các bình luận cũ chưa có likes
    if (!Array.isArray(comment.likes)) {
      comment.likes = [];
    }

    const hasLiked = comment.likes.some(
      (likedUserId) =>
        likedUserId.toString() === userId
    );

    if (hasLiked) {
      comment.likes = comment.likes.filter(
        (likedUserId) =>
          likedUserId.toString() !== userId
      );
    } else {
      comment.likes.push(
        new mongoose.Types.ObjectId(userId)
      );
    }

    await comment.save();

    return res.status(200).json({
      success: true,
      message: hasLiked
        ? "Đã bỏ thích bình luận"
        : "Đã thích bình luận",
      isLiked: !hasLiked,
      likesCount: comment.likes.length,
      likes: comment.likes,
    });
  } catch (error) {
    console.error(
      "Lỗi thích bình luận:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Không thể thích bình luận",
    });
  }
};
// Sửa nội dung bình luận của chính mình
export const updateComment = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;

    const commentIdParam =
      req.params.commentId;

    const commentId = Array.isArray(
      commentIdParam
    )
      ? commentIdParam[0]
      : commentIdParam;

    const content =
      typeof req.body.content === "string"
        ? req.body.content.trim()
        : "";

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập",
      });
    }

    if (
      !commentId ||
      !mongoose.isValidObjectId(commentId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Mã bình luận không hợp lệ",
      });
    }

    if (!content) {
      return res.status(400).json({
        success: false,
        message:
          "Nội dung bình luận không được để trống",
      });
    }

    if (content.length > 500) {
      return res.status(400).json({
        success: false,
        message:
          "Bình luận không được vượt quá 500 ký tự",
      });
    }

    const comment =
      await Comment.findOneAndUpdate(
        {
          _id: commentId,
          author: userId,
          isActive: true,
        },
        {
          content,
        },
        {
          new: true,
          runValidators: true,
        }
      ).populate(
        "author",
        "fullName email avatarUrl"
      );

    if (!comment) {
      return res.status(404).json({
        success: false,
        message:
          "Không tìm thấy bình luận hoặc bạn không có quyền sửa",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Sửa bình luận thành công",
      comment,
    });
  } catch (error) {
    console.error(
      "Lỗi sửa bình luận:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Không thể sửa bình luận",
    });
  }
};