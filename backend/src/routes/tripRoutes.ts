import { Router } from "express";

import {
  createTripActivity,
  deleteTripActivity,
  getTripActivities,
  updateTripActivity,
} from "../controllers/tripActivityController.js";

import {
  createTrip,
  deleteTrip,
  getCompanionTrips,
  getMyTrips,
  getTripById,
  updateTrip,
} from "../controllers/tripController.js";

import {
  protect,
} from "../middlewares/authMiddleware.js";

const router = Router();

// Tạo chuyến đi mới
router.post(
  "/",
  protect,
  createTrip
);

// Lấy các chuyến đi người dùng tạo
// hoặc đang tham gia
router.get(
  "/my",
  protect,
  getMyTrips
);

// Lấy các chuyến đi công khai
// đang tìm bạn đồng hành
// Phải đặt trước route "/:tripId"
router.get(
  "/companions",
  protect,
  getCompanionTrips
);

// Lấy lịch trình của chuyến đi
router.get(
  "/:tripId/activities",
  protect,
  getTripActivities
);

// Thêm hoạt động vào chuyến đi
router.post(
  "/:tripId/activities",
  protect,
  createTripActivity
);

// Sửa một hoạt động
router.put(
  "/activities/:activityId",
  protect,
  updateTripActivity
);

// Xóa một hoạt động
router.delete(
  "/activities/:activityId",
  protect,
  deleteTripActivity
);

// Xem chi tiết chuyến đi
router.get(
  "/:tripId",
  protect,
  getTripById
);

// Sửa thông tin chuyến đi
router.put(
  "/:tripId",
  protect,
  updateTrip
);

// Xóa chuyến đi
router.delete(
  "/:tripId",
  protect,
  deleteTrip
);

export default router;