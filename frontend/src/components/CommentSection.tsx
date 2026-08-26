import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import axiosClient from "../api/axiosClient";
import { Link } from "react-router-dom";

interface CommentAuthor {
  _id: string;
  fullName: string;
  avatarUrl?: string;
}

interface CommentData {
  _id: string;
  post: string;
  author: CommentAuthor;
  parentComment: string | null;
  content: string;
  imageUrl?: string;
  createdAt: string;
  likes?: string[];
}

interface CommentsResponse {
  success: boolean;
  comments: CommentData[];
}

interface CreateCommentResponse {
  success: boolean;
  message: string;
  comment: CommentData;
}

interface UpdateCommentResponse {
  success: boolean;
  message: string;
  comment: CommentData;
}

interface LikeCommentResponse {
  success: boolean;
  message: string;
  isLiked: boolean;
  likesCount: number;
  likes: string[];
}
interface CommentSectionProps {
  postId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string | undefined;
  onCommentsCountChange: (count: number) => void;
}


interface ReplyTarget {
  comment: CommentData;
  parentId: string;
}

function CommentSection({
  postId,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  onCommentsCountChange,
}: CommentSectionProps) {
  const [comments, setComments] =
    useState<CommentData[]>([]);

  const [content, setContent] = useState("");

  const [selectedImage, setSelectedImage] =
    useState<File | null>(null);

  const [previewUrl, setPreviewUrl] =
    useState("");

  const [replyingTo, setReplyingTo] =
    useState<ReplyTarget | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [deletingCommentId, setDeletingCommentId] =
    useState<string | null>(null);

  const [message, setMessage] = useState("");

  const [likingCommentId, setLikingCommentId] =
    useState<string | null>(null);

  const [openCommentMenuId, setOpenCommentMenuId] =
    useState<string | null>(null);

  const [editingCommentId, setEditingCommentId] =
    useState<string | null>(null);

  const [editContent, setEditContent] =
    useState("");

  const [isUpdatingComment, setIsUpdatingComment] =
    useState(false);

  // Lấy bình luận từ Backend
  useEffect(() => {
    const getComments = async () => {
      try {
        const response =
          await axiosClient.get<CommentsResponse>(
            `/comments/posts/${postId}`
          );

        const loadedComments = response.data.comments;

        setComments(loadedComments);
        onCommentsCountChange(
          loadedComments.length
        );
      } catch (error: any) {
        setMessage(
          error.response?.data?.message ||
            "Không thể lấy bình luận"
        );
      } finally {
        setIsLoading(false);
      }
    };

    getComments();
  }, [postId]);

  // Giải phóng ảnh xem trước
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const getFirstLetter = (
    fullName: string
  ) => {
    return (
      fullName
        .trim()
        .charAt(0)
        .toUpperCase() || "U"
    );
  };

  const handleImageChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const image = event.target.files?.[0];

    event.target.value = "";

    if (!image) {
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(image.type)) {
      setMessage(
        "Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP"
      );
      return;
    }

    if (image.size > 5 * 1024 * 1024) {
      setMessage(
        "Ảnh không được vượt quá 5 MB"
      );
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedImage(image);
    setPreviewUrl(
      URL.createObjectURL(image)
    );
    setMessage("");
  };

  const removeSelectedImage = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl("");
    setSelectedImage(null);
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setMessage("");

    if (!content.trim() && !selectedImage) {
      setMessage(
        "Bạn cần nhập nội dung hoặc chọn một ảnh"
      );
      return;
    }

    const formData = new FormData();

    formData.append(
      "content",
      content.trim()
    );

    if (selectedImage) {
      formData.append(
        "image",
        selectedImage
      );
    }

    if (replyingTo) {
      formData.append(
        "parentCommentId",
        replyingTo.parentId
      );
    }

    try {
      setIsSubmitting(true);

      const response =
        await axiosClient.post<CreateCommentResponse>(
          `/comments/posts/${postId}`,
          formData
        );

      setComments((currentComments) => {
        const updatedComments = [
          ...currentComments,
          response.data.comment,
        ];

        onCommentsCountChange(
          updatedComments.length
        );

        return updatedComments;
      });

      setContent("");
      setReplyingTo(null);
      removeSelectedImage();
    } catch (error: any) {
      setMessage(
        error.response?.data?.message ||
          "Không thể gửi bình luận"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartReply = (
    comment: CommentData,
    parentId: string
  ) => {
    setReplyingTo({
      comment,
      parentId,
    });

    window.setTimeout(() => {
      document
        .getElementById(
          `comment-${postId}`
        )
        ?.focus();
    }, 50);
  };

  const handleDeleteComment = async (
    comment: CommentData
  ) => {
    const isConfirmed = window.confirm(
      "Bạn có chắc muốn xóa bình luận này không?"
    );

    if (!isConfirmed) {
      return;
    }

    try {
      setDeletingCommentId(comment._id);

      await axiosClient.delete(
        `/comments/${comment._id}`
      );

      setComments((currentComments) => {
        const updatedComments =
          currentComments.filter(
          (currentComment) =>
            currentComment._id !==
              comment._id &&
            currentComment.parentComment !==
              comment._id
          );

        onCommentsCountChange(
          updatedComments.length
        );

        return updatedComments;
      });

      if (
        replyingTo?.comment._id ===
        comment._id
      ) {
        setReplyingTo(null);
      }
    } catch (error: any) {
      setMessage(
        error.response?.data?.message ||
          "Không thể xóa bình luận"
      );
    } finally {
      setDeletingCommentId(null);
    }
  };

  // Thích hoặc bỏ thích bình luận/câu trả lời
  const handleToggleLikeComment = async (
    commentId: string
  ) => {
    try {
      setLikingCommentId(commentId);

      const response =
        await axiosClient.patch<LikeCommentResponse>(
          `/comments/${commentId}/like`
        );

      setComments((currentComments) =>
        currentComments.map((comment) =>
          comment._id === commentId
            ? {
                ...comment,
                likes: response.data.likes,
              }
            : comment
        )
      );
    } catch (error: any) {
      setMessage(
        error.response?.data?.message ||
          "Không thể thích bình luận"
      );
    } finally {
      setLikingCommentId(null);
    }
  };

  const handleStartEditComment = (
    comment: CommentData
  ) => {
    setEditingCommentId(comment._id);
    setEditContent(comment.content);
    setOpenCommentMenuId(null);
    setMessage("");
  };

  const handleCancelEditComment = () => {
    setEditingCommentId(null);
    setEditContent("");
  };

  const handleUpdateComment = async (
    event: FormEvent<HTMLFormElement>,
    commentId: string
  ) => {
    event.preventDefault();

    const trimmedContent = editContent.trim();

    if (!trimmedContent) {
      setMessage(
        "Nội dung bình luận không được để trống"
      );
      return;
    }

    try {
      setIsUpdatingComment(true);
      setMessage("");

      const response =
        await axiosClient.patch<UpdateCommentResponse>(
          `/comments/${commentId}`,
          { content: trimmedContent }
        );

      setComments((currentComments) =>
        currentComments.map((comment) =>
          comment._id === commentId
            ? response.data.comment
            : comment
        )
      );

      setEditingCommentId(null);
      setEditContent("");
    } catch (error: any) {
      setMessage(
        error.response?.data?.message ||
          "Không thể sửa bình luận"
      );
    } finally {
      setIsUpdatingComment(false);
    }
  };

  const rootComments = comments.filter(
    (comment) => !comment.parentComment
  );

  const getReplies = (
    rootCommentId: string
  ) => {
    return comments.filter(
      (comment) =>
        comment.parentComment ===
        rootCommentId
    );
  };

  const renderComment = (
    comment: CommentData,
    rootCommentId: string,
    isReply: boolean
  ) => {
    return (
      <div
        className={
          isReply
            ? "facebook-comment reply-comment"
            : "facebook-comment"
        }
        key={comment._id}
      >
        <Link
  className="comment-avatar comment-avatar-link"
  to={`/users/${comment.author._id}`}
  title={`Xem trang cá nhân của ${comment.author.fullName}`}
>
  {comment.author.avatarUrl ? (
    <img
      src={comment.author.avatarUrl}
      alt={comment.author.fullName}
    />
  ) : (
    getFirstLetter(
      comment.author.fullName
    )
  )}
</Link>
        <div className="comment-main">
          <div className="comment-content-row">
            <div className="comment-bubble">
              <Link
  className="comment-author-link"
  to={`/users/${comment.author._id}`}
>
  {comment.author.fullName}
</Link>

              {editingCommentId === comment._id ? (
                <form
                  className="edit-comment-form"
                  onSubmit={(event) =>
                    handleUpdateComment(
                      event,
                      comment._id
                    )
                  }
                >
                  <textarea
                    value={editContent}
                    onChange={(event) =>
                      setEditContent(event.target.value)
                    }
                    maxLength={500}
                    autoFocus
                  />

                  <div className="edit-comment-actions">
                    <button
                      type="button"
                      onClick={handleCancelEditComment}
                    >
                      Hủy
                    </button>

                    <button
                      className="save-comment-button"
                      type="submit"
                      disabled={
                        isUpdatingComment ||
                        !editContent.trim()
                      }
                    >
                      {isUpdatingComment
                        ? "Đang lưu..."
                        : "Lưu"}
                    </button>
                  </div>
                </form>
              ) : (
                comment.content && (
                  <p>{comment.content}</p>
                )
              )}
            </div>

            {String(comment.author._id) ===
              String(currentUserId) && (
              <div className="comment-more-wrapper">
                <button
                  className="comment-more-button"
                  type="button"
                  aria-label="Tùy chọn bình luận"
                  onClick={() =>
                    setOpenCommentMenuId(
                      openCommentMenuId === comment._id
                        ? null
                        : comment._id
                    )
                  }
                >
                  ⋯
                </button>

                {openCommentMenuId ===
                  comment._id && (
                  <div className="comment-more-menu">
                    <button
                      type="button"
                      onClick={() =>
                        handleStartEditComment(comment)
                      }
                    >
                      ✏️ Sửa bình luận
                    </button>

                    <button
                      className="delete-comment-option"
                      type="button"
                      disabled={
                        deletingCommentId === comment._id
                      }
                      onClick={() => {
                        setOpenCommentMenuId(null);
                        handleDeleteComment(comment);
                      }}
                    >
                      🗑️{" "}
                      {deletingCommentId === comment._id
                        ? "Đang xóa..."
                        : "Xóa bình luận"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {comment.imageUrl && (
            <img
              className="comment-attached-image"
              src={comment.imageUrl}
              alt="Ảnh bình luận"
            />
          )}

          <div className="comment-options">
            <span>
              {new Date(
                comment.createdAt
              ).toLocaleString("vi-VN", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </span>

            <button
              className={
                (comment.likes ?? []).includes(
                  currentUserId
                )
                  ? "comment-like-button liked"
                  : "comment-like-button"
              }
              type="button"
              disabled={
                likingCommentId === comment._id
              }
              onClick={() =>
                handleToggleLikeComment(
                  comment._id
                )
              }
            >
              {likingCommentId === comment._id
                ? "..."
                : (comment.likes ?? []).includes(
                      currentUserId
                    )
                  ? "Đã thích"
                  : "Thích"}

              {(comment.likes ?? []).length > 0 &&
                ` (${(comment.likes ?? []).length})`}
            </button>

            <button
              type="button"
              onClick={() =>
                handleStartReply(
                  comment,
                  rootCommentId
                )
              }
            >
              Trả lời
            </button>

          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="facebook-comments">
      <div className="comment-sort">
        <strong>
          {comments.length} bình luận
        </strong>

        <button type="button">
          Phù hợp nhất ▾
        </button>
      </div>

      {isLoading ? (
        <p className="comment-status">
          Đang tải bình luận...
        </p>
      ) : rootComments.length === 0 ? (
        <p className="comment-status">
          Chưa có bình luận nào.
        </p>
      ) : (
        <div className="comment-threads">
          {rootComments.map((rootComment) => {
            const replies = getReplies(
              rootComment._id
            );

            return (
              <div
                className="comment-thread"
                key={rootComment._id}
              >
                
                {renderComment(
                  rootComment,
                  rootComment._id,
                  false
                )}

                {replies.length > 0 && (
                  <div className="comment-replies">
                    {replies.map((reply) =>
                      renderComment(
                        reply,
                        rootComment._id,
                        true
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {replyingTo && (
        <div className="replying-notice">
          <span>
            Đang trả lời{" "}
            <strong>
              {
                replyingTo.comment.author
                  .fullName
              }
            </strong>
          </span>

          <button
            type="button"
            onClick={() =>
              setReplyingTo(null)
            }
          >
            ×
          </button>
        </div>
      )}

      {previewUrl && (
        <div className="comment-image-preview">
          <img
            src={previewUrl}
            alt="Ảnh bình luận đã chọn"
          />

          <button
            type="button"
            onClick={removeSelectedImage}
          >
            ×
          </button>
        </div>
      )}

      <form
        className="facebook-comment-form"
        onSubmit={handleSubmit}
      >
        <div className="comment-avatar">
          {currentUserAvatar ? (
            <img
              src={currentUserAvatar}
              alt={currentUserName}
            />
          ) : (
            getFirstLetter(currentUserName)
          )}
        </div>

        <div className="comment-input-wrapper">
          <input
            id={`comment-${postId}`}
            type="text"
            value={content}
            onChange={(event) =>
              setContent(event.target.value)
            }
            placeholder={
              replyingTo
                ? `Trả lời ${replyingTo.comment.author.fullName}...`
                : "Viết bình luận..."
            }
            maxLength={500}
          />

          <div className="comment-input-tools">
            <label
              htmlFor={`gallery-${postId}`}
              title="Chọn ảnh"
            >
              🖼️
            </label>

            <input
              id={`gallery-${postId}`}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={handleImageChange}
            />

            <label
              htmlFor={`camera-${postId}`}
              title="Chụp ảnh"
            >
              📷
            </label>

            <input
              id={`camera-${postId}`}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={handleImageChange}
            />

            <button
              type="submit"
              title="Gửi bình luận"
              disabled={
                isSubmitting ||
                (!content.trim() &&
                  !selectedImage)
              }
            >
              {isSubmitting ? "..." : "➤"}
            </button>
          </div>
        </div>
      </form>

      {message && (
        <div className="comment-message">
          {message}
        </div>
      )}
    </section>
  );
}

export default CommentSection;