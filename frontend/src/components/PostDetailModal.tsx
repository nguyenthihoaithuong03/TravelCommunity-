import { useEffect } from "react";
import { Link } from "react-router-dom";
import CommentSection from "./CommentSection";
import type { PostData } from "./CreatePostModal";

interface CurrentUserData {
  _id: string;
  fullName: string;
  avatarUrl?: string;
}

interface PostDetailModalProps {
  post: PostData;
  currentUser: CurrentUserData;
  isLiked: boolean;
  isLiking: boolean;
  onClose: () => void;
  onToggleLike: (postId: string) => void;
  onSharePost: (post: PostData) => void;
  onCommentsCountChange: (
    postId: string,
    count: number
  ) => void;
}

function PostDetailModal({
  post,
  currentUser,
  isLiked,
  isLiking,
  onClose,
  onToggleLike,
  onSharePost,
  onCommentsCountChange,
}: PostDetailModalProps) {
  // Khóa cuộn trang Home khi cửa sổ mở
  // và cho phép nhấn Escape để đóng.
  useEffect(() => {
    const handleEscape = (
      event: KeyboardEvent
    ) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener(
      "keydown",
      handleEscape
    );

    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape
      );

      document.body.style.overflow = "";
    };
  }, [onClose]);

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

  return (
    <div
      className="post-detail-overlay"
      onMouseDown={onClose}
    >
      <section
        className="post-detail-modal"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <header className="post-detail-header">
          <h2>
            Bài viết của {post.author.fullName}
          </h2>

          <button
            className="close-post-detail"
            type="button"
            aria-label="Đóng"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="post-detail-scroll">
          <div className="post-detail-author">
           <Link
             className="feed-post-avatar author-avatar-link"
          to={`/users/${post.author._id}`}
         title={`Xem trang cá nhân của ${post.author.fullName}`}
             onClick={onClose}
      >
           {post.author.avatarUrl ? (
         <img
         src={post.author.avatarUrl}
          alt={post.author.fullName}
        />
          ) : (
               getFirstLetter(
                 post.author.fullName
               )
            )}
             </Link>

            <div>
              <Link
               className="author-name-link"
            to={`/users/${post.author._id}`}
                  onClick={onClose}
                  >
                 {post.author.fullName}
               </Link>

              <div className="feed-post-meta">
                {new Date(
                  post.createdAt
                ).toLocaleString("vi-VN")}

                {post.location && (
                  <>
                    {" · "}📍 {post.location}
                  </>
                )}
              </div>
            </div>
          </div>

          {post.content && (
            <p className="post-detail-content">
              {post.content}
            </p>
          )}

          {post.imageUrls.length > 0 && (
            <div
              className={
                post.imageUrls.length === 1
                  ? "post-detail-images one-image"
                  : post.imageUrls.length === 2
                    ? "post-detail-images two-images"
                    : "post-detail-images many-images"
              }
            >
              {post.imageUrls.map(
                (imageUrl, index) => (
                  <div
                    className="post-detail-image-item"
                    key={`${post._id}-${index}`}
                  >
                    <img
                      src={imageUrl}
                      alt={`Ảnh bài viết ${index + 1}`}
                    />

                    {index === 3 &&
                      post.imageUrls.length > 4 && (
                        <div className="more-images">
                          +{post.imageUrls.length - 4}
                        </div>
                      )}
                  </div>
                )
              )}
            </div>
          )}

          <div className="feed-post-actions compact-actions">
  {/* Thích */}
  <button
    className={
      isLiked
        ? "compact-action liked"
        : "compact-action"
    }
    type="button"
    aria-label="Thích bài viết"
    aria-pressed={isLiked}
    disabled={isLiking}
    onClick={() => onToggleLike(post._id)}
  >
    {isLiking ? (
      <span>...</span>
    ) : (
      <>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 10v11H3V10h4Zm4.3 11H9V10.2l3.8-7.1c.4-.8 1.4-1.2 2.2-.8.7.3 1.1 1.1.9 1.8L15 8h4.3c1.5 0 2.6 1.4 2.2 2.8l-2.1 7.5c-.4 1.6-1.9 2.7-3.5 2.7h-4.6Z" />
        </svg>

        <span>{post.likes.length}</span>
      </>
    )}
  </button>

  {/* Bình luận */}
  <button
    className="compact-action"
    type="button"
    title="Bình luận"
    onClick={() => {
      document
        .getElementById(`comment-${post._id}`)
        ?.focus();
    }}
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.6 9.6 0 0 1-3.7-.9L3 21l1.7-4.4A8.3 8.3 0 0 1 3 11.5C3 6.8 7 3 12 3s9 3.8 9 8.5Z" />
    </svg>

    <span>{post.commentsCount ?? 0}</span>
  </button>

  {/* Chia sẻ */}
  <button
    className="compact-action"
    type="button"
    title="Chia sẻ"
    onClick={() => onSharePost(post)}
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m14 5 7 7-7 7v-4c-5 0-8.5 1.4-11 4 1-5 4-9 11-10V5Z" />
    </svg>

    <span>{post.sharesCount ?? 0}</span>
  </button>
</div>
          <div className="post-detail-comments">
            <CommentSection
              postId={post._id}
              currentUserId={currentUser._id}
              currentUserName={
                currentUser.fullName
              }
              currentUserAvatar={
                currentUser.avatarUrl
              }
              onCommentsCountChange={(count) =>
                onCommentsCountChange(
                  post._id,
                  count
                )
              }
            />
          </div>
        </div>
      </section>
    </div>
  );
}

export default PostDetailModal;