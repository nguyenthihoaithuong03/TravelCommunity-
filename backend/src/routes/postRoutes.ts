import { Router } from "express";

import {
  createPost,
  deletePost,
  getPosts,
  getUserPosts,
  sharePost,
  toggleLikePost,
  updatePost,
} from "../controllers/postController.js";
import { protect } from "../middlewares/authMiddleware.js";
import uploadImage from "../middlewares/uploadMiddleware.js";

const router = Router();

// Lấy danh sách bài viết
router.get("/", protect, getPosts);
// Lấy bài viết theo người dùng
router.get(
  "/user/:userId",
  protect,
  getUserPosts
);

// Tạo bài viết có tối đa 5 ảnh
router.post(
  "/",
  protect,
  uploadImage.array("images", 5),
  createPost
);

// Sửa nội dung và địa điểm
router.put("/:postId", protect, updatePost);

// Xóa bài viết
router.delete(
  "/:postId",
  protect,
  deletePost
);
router.patch(
  "/:postId/like",
  protect,
  toggleLikePost
);
router.patch(
  "/:postId/share",
  protect,
  sharePost
);
export default router;