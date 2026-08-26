import { Router } from "express";

import {
  createComment,
  deleteComment,
  getPostComments,
  toggleLikeComment,
  updateComment,
} from "../controllers/commentController.js";
import { protect } from "../middlewares/authMiddleware.js";
import uploadImage from "../middlewares/uploadMiddleware.js";

const router = Router();

// Lấy bình luận và câu trả lời của bài viết
router.get(
  "/posts/:postId",
  protect,
  getPostComments
);

// Gửi bình luận hoặc trả lời
// Có thể kèm một ảnh
router.post(
  "/posts/:postId",
  protect,
  uploadImage.single("image"),
  createComment
);
router.patch("/:commentId", protect, updateComment);

// Xóa bình luận hoặc câu trả lời của mình
router.delete(
  "/:commentId",
  protect,
  deleteComment
);
// Thích hoặc bỏ thích bình luận
router.patch(
  "/:commentId/like",
  protect,
  toggleLikeComment
);
export default router;