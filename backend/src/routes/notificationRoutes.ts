import { Router } from "express";

import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../controllers/notificationController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = Router();

// Lấy danh sách thông báo
router.get(
  "/",
  protect,
  getNotifications
);

// Đếm thông báo chưa đọc
router.get(
  "/unread-count",
  protect,
  getUnreadNotificationCount
);

// Đánh dấu tất cả là đã đọc
router.patch(
  "/read-all",
  protect,
  markAllNotificationsAsRead
);

// Đánh dấu một thông báo đã đọc
router.patch(
  "/:notificationId/read",
  protect,
  markNotificationAsRead
);

export default router;