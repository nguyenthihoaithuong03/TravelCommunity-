import { Router } from "express";

import {
  getCurrentUser,
  getUserProfile,
  getUserConnections,
  searchUsers,
  toggleFollowUser,
  updateCurrentUser,
  uploadAvatar,
} from "../controllers/userController.js";
import { protect } from "../middlewares/authMiddleware.js";
import uploadImage from "../middlewares/uploadMiddleware.js";

const router = Router();

router.get("/me", protect, getCurrentUser);
router.get(
  "/search",
  protect,
  searchUsers
);

router.put("/me", protect, updateCurrentUser);
router.post(
  "/avatar",
  protect,
  uploadImage.single("avatar"),
  uploadAvatar
);

// Theo dõi hoặc bỏ theo dõi người khác
router.patch(
  "/:userId/follow",
  protect,
  toggleFollowUser
);
// Danh sách người theo dõi và đang theo dõi
router.get(
  "/:userId/connections",
  protect,
  getUserConnections
);
// Xem hồ sơ công khai của người khác
router.get(
  "/:userId",
  protect,
  getUserProfile
);

export default router;
