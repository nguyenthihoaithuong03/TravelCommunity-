import type { Response } from "express";
import mongoose from "mongoose";

import type {
  AuthRequest,
} from "../middlewares/authMiddleware.js";
import Notification from "../models/Notification.js";

// Lấy danh sách thông báo
export const getNotifications = async (
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

    const notifications =
      await Notification.find({
        recipient: userId,
      })
        .populate(
          "sender",
          "fullName avatarUrl"
        )
        .sort({ createdAt: -1 })
        .limit(50);

    return res.status(200).json({
      success: true,
      notifications,
    });
  } catch (error) {
    console.error(
      "Lỗi lấy danh sách thông báo:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Không thể lấy thông báo",
    });
  }
};

// Đếm thông báo chưa đọc
export const getUnreadNotificationCount =
  async (
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

      const unreadCount =
        await Notification.countDocuments({
          recipient: userId,
          isRead: false,
        });

      return res.status(200).json({
        success: true,
        unreadCount,
      });
    } catch (error) {
      console.error(
        "Lỗi đếm thông báo chưa đọc:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Không thể đếm thông báo chưa đọc",
      });
    }
  };

// Đánh dấu một thông báo đã đọc
export const markNotificationAsRead =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const userId = req.user?.userId;

      const notificationIdParam =
        req.params.notificationId;

      const notificationId = Array.isArray(
        notificationIdParam
      )
        ? notificationIdParam[0]
        : notificationIdParam;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Bạn chưa đăng nhập",
        });
      }

      if (
        !notificationId ||
        !mongoose.isValidObjectId(
          notificationId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Mã thông báo không hợp lệ",
        });
      }

      const notification =
        await Notification.findOneAndUpdate(
          {
            _id: notificationId,
            recipient: userId,
          },
          {
            isRead: true,
          },
          {
            new: true,
          }
        ).populate(
          "sender",
          "fullName avatarUrl"
        );

      if (!notification) {
        return res.status(404).json({
          success: false,
          message:
            "Không tìm thấy thông báo",
        });
      }

      return res.status(200).json({
        success: true,
        notification,
      });
    } catch (error) {
      console.error(
        "Lỗi đánh dấu thông báo:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Không thể cập nhật thông báo",
      });
    }
  };

// Đánh dấu tất cả thông báo đã đọc
export const markAllNotificationsAsRead =
  async (
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

      await Notification.updateMany(
        {
          recipient: userId,
          isRead: false,
        },
        {
          isRead: true,
        }
      );

      return res.status(200).json({
        success: true,
        message:
          "Đã đánh dấu tất cả thông báo là đã đọc",
      });
    } catch (error) {
      console.error(
        "Lỗi đọc tất cả thông báo:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Không thể cập nhật thông báo",
      });
    }
  };