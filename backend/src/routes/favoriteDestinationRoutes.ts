import { Router } from "express";

import {
  getFavoriteDestinations,
  toggleFavoriteDestination,
} from "../controllers/favoriteDestinationController.js";

import {
  protect,
} from "../middlewares/authMiddleware.js";

const router = Router();

// Lấy danh sách địa điểm đã lưu.
router.get(
  "/",
  protect,
  getFavoriteDestinations
);

// Lưu hoặc bỏ lưu địa điểm.
router.post(
  "/toggle",
  protect,
  toggleFavoriteDestination
);

export default router;