import {
  useState,
  type FormEvent,
} from "react";

import axiosClient from "../api/axiosClient";
import type {
  PostData,
} from "./CreatePostModal";

interface UpdatePostResponse {
  success: boolean;
  message: string;
  post: PostData;
}

interface EditPostModalProps {
  post: PostData;
  onClose: () => void;
  onPostUpdated: (post: PostData) => void;
}

function EditPostModal({
  post,
  onClose,
  onPostUpdated,
}: EditPostModalProps) {
  const [content, setContent] =
    useState(post.content);

  const [location, setLocation] =
    useState(post.location || "");

  const [message, setMessage] = useState("");

  const [isSaving, setIsSaving] =
    useState(false);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setMessage("");

    if (!content.trim()) {
      setMessage(
        "Nội dung bài viết không được để trống"
      );
      return;
    }

    try {
      setIsSaving(true);

      const response =
        await axiosClient.put<UpdatePostResponse>(
          `/posts/${post._id}`,
          {
            content: content.trim(),
            location: location.trim(),
          }
        );

      onPostUpdated(response.data.post);
      onClose();
    } catch (error: any) {
      setMessage(
        error.response?.data?.message ||
          "Không thể cập nhật bài viết"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="post-modal-overlay"
      onMouseDown={onClose}
    >
      <div
        className="post-modal"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div className="post-modal-header">
          <h2>Chỉnh sửa bài viết</h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="editPostContent">
            Nội dung bài viết
          </label>

          <textarea
            id="editPostContent"
            value={content}
            onChange={(event) =>
              setContent(event.target.value)
            }
            maxLength={2000}
            rows={7}
            autoFocus
          />

          <div className="post-character-count">
            {content.length}/2000
          </div>

          <label htmlFor="editPostLocation">
            Địa điểm
          </label>

          <input
            id="editPostLocation"
            type="text"
            value={location}
            onChange={(event) =>
              setLocation(event.target.value)
            }
            placeholder="Ví dụ: Đà Lạt, Lâm Đồng"
            maxLength={200}
          />

          {post.imageUrls.length > 0 && (
            <div className="edit-post-images">
              {post.imageUrls.map(
                (imageUrl, index) => (
                  <img
                    key={`${imageUrl}-${index}`}
                    src={imageUrl}
                    alt="Ảnh bài viết"
                  />
                )
              )}

              <small>
                Ảnh hiện tại được giữ nguyên khi sửa.
              </small>
            </div>
          )}

          {message && (
            <div className="post-modal-message">
              {message}
            </div>
          )}

          <button
            className="submit-post-button"
            type="submit"
            disabled={
              isSaving || !content.trim()
            }
          >
            {isSaving
              ? "Đang lưu..."
              : "Lưu thay đổi"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default EditPostModal;