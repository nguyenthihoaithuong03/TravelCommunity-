import { Router } from "express";

import {
  cancelJoinRequest,
  cancelTripInvitation,
  getJoinRequestStatus,
  getMyTripInvitations,
  getPendingInvitationCount,
  respondToTripInvitation,
  sendJoinRequest,
  sendTripInvitation,
} from "../controllers/tripInvitationController.js";

import {
  protect,
} from "../middlewares/authMiddleware.js";

const router = Router();

// Lấy các lời mời hoặc yêu cầu mà tài khoản
// đang đăng nhập cần phản hồi.
router.get(
  "/my",
  protect,
  getMyTripInvitations
);

// Đếm số lời mời và yêu cầu đang chờ.
router.get(
  "/pending-count",
  protect,
  getPendingInvitationCount
);

// Kiểm tra người dùng đã gửi yêu cầu tham gia
// chuyến đi này hay chưa.
router.get(
  "/trips/:tripId/join-request",
  protect,
  getJoinRequestStatus
);

// Người dùng gửi yêu cầu tham gia chuyến đi.
router.post(
  "/trips/:tripId/join-request",
  protect,
  sendJoinRequest
);

// Người dùng hủy yêu cầu tham gia đã gửi.
router.delete(
  "/trips/:tripId/join-request",
  protect,
  cancelJoinRequest
);

// Chủ chuyến đi gửi lời mời cho người khác.
router.post(
  "/trips/:tripId",
  protect,
  sendTripInvitation
);

// Người nhận đồng ý hoặc từ chối lời mời,
// hoặc chủ chuyến đi xử lý yêu cầu tham gia.
router.patch(
  "/:invitationId/respond",
  protect,
  respondToTripInvitation
);

// Chủ chuyến đi hủy lời mời đã gửi.
router.delete(
  "/:invitationId",
  protect,
  cancelTripInvitation
);

export default router;