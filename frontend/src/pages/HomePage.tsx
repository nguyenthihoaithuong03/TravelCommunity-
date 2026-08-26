import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
} from "react-router-dom";

import axiosClient from "../api/axiosClient";
import CreatePostModal, {
  type PostData,
} from "../components/CreatePostModal";
import EditPostModal from "../components/EditPostModal";
import PostDetailModal from "../components/PostDetailModal";
import "../styles/home.css";
import socketClient from "../socketClient";

interface UserData {
  _id: string;
  fullName: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

interface CurrentUserResponse {
  success: boolean;
  user: UserData;
}

type FeedPostData = PostData & {
  commentsCount?: number;
};

interface PostsResponse {
  success: boolean;
  posts: FeedPostData[];
}

interface LikePostResponse {
  success: boolean;
  message: string;
  isLiked: boolean;
  likesCount: number;
  likes: string[];
}
interface SharePostResponse {
  success: boolean;
  message: string;
  sharesCount: number;
}

interface UnreadNotificationResponse {
  success: boolean;
  unreadCount: number;
}
interface PendingInvitationCountResponse {
  success: boolean;
  pendingCount: number;
}
function HomePage() {
  const navigate = useNavigate();

  const [user, setUser] =
    useState<UserData | null>(null);

  const [posts, setPosts] =
    useState<FeedPostData[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isLoadingPosts, setIsLoadingPosts] =
    useState(true);

  const [isCreatePostOpen, setIsCreatePostOpen] =
    useState(false);

  const [editingPost, setEditingPost] =
    useState<PostData | null>(null);

  const [deletingPostId, setDeletingPostId] =
    useState<string | null>(null);

  const [message, setMessage] = useState("");

  const [likingPostId, setLikingPostId] =
    useState<string | null>(null);

  const [isSideMenuOpen, setIsSideMenuOpen] =
    useState(false);

  const [openPostMenuId, setOpenPostMenuId] =
    useState<string | null>(null);

  const [
    unreadNotificationCount,
    setUnreadNotificationCount,
  ] = useState(0);

  const [
    pendingInvitationCount,
    setPendingInvitationCount,
  ] = useState(0);

  // Bài viết đang được mở trong cửa sổ chi tiết
  const [selectedPost, setSelectedPost] =
    useState<PostData | null>(null);

  // Lấy thông tin người đang đăng nhập
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const response =
          await axiosClient.get<CurrentUserResponse>(
            "/users/me"
          );

        setUser(response.data.user);

        localStorage.setItem(
          "user",
          JSON.stringify(response.data.user)
        );
      } catch (error: any) {
        setMessage(
          error.response?.data?.message ||
            "Không thể lấy thông tin người dùng"
        );

        if (error.response?.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/login");
        }
      } finally {
        setIsLoading(false);
      }
    };

    getCurrentUser();
  }, [navigate]);

  // Lấy danh sách bài viết
  useEffect(() => {
    const getPosts = async () => {
      try {
        const response =
          await axiosClient.get<PostsResponse>(
            "/posts"
          );

        setPosts(response.data.posts);
      } catch (error: any) {
        setMessage(
          error.response?.data?.message ||
            "Không thể lấy danh sách bài viết"
        );
      } finally {
        setIsLoadingPosts(false);
      }
    };

    getPosts();
  }, []);
  // Tự mở bài viết từ đường link chia sẻ.
  useEffect(() => {
    if (posts.length === 0) {
      return;
    }

    const searchParams = new URLSearchParams(
      window.location.search
    );

    const sharedPostId = searchParams.get("post");

    if (!sharedPostId) {
      return;
    }

    const sharedPost = posts.find(
      (post) => post._id === sharedPostId
    );

    if (sharedPost) {
      setSelectedPost(sharedPost);
    }
  }, [posts]);

  // Lấy số thông báo chưa đọc và kiểm tra
  // thông báo mới sau mỗi 15 giây.
  useEffect(() => {
    const getUnreadNotificationCount = async () => {
      try {
        const response =
          await axiosClient.get<UnreadNotificationResponse>(
            "/notifications/unread-count"
          );

        setUnreadNotificationCount(
          response.data.unreadCount
        );
      } catch (error) {
        console.error(
          "Không thể đếm thông báo:",
          error
        );
      }
    };

    getUnreadNotificationCount();

    const intervalId = window.setInterval(
      getUnreadNotificationCount,
      15000
    );

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  // Lấy số lời mời chuyến đi đang chờ và cập nhật
  // lại sau mỗi 15 giây.
  useEffect(() => {
    const getPendingInvitationCount = async () => {
      try {
        const response =
          await axiosClient.get<PendingInvitationCountResponse>(
            "/trip-invitations/pending-count"
          );

        setPendingInvitationCount(
          response.data.pendingCount
        );
      } catch (error) {
        console.error(
          "Không thể đếm lời mời chuyến đi:",
          error
        );
      }
    };

    void getPendingInvitationCount();

    const invitationIntervalId =
      window.setInterval(
        getPendingInvitationCount,
        15000
      );

    return () => {
      window.clearInterval(
        invitationIntervalId
      );
    };
  }, []);

  // Kết nối Socket.IO để nhận thông báo ngay lập tức.
  useEffect(() => {
    if (!user?._id) {
      return;
    }

    const joinNotificationRoom = () => {
      socketClient.emit("join-user", user._id);
    };

    const handleNewNotification = () => {
      setUnreadNotificationCount(
        (currentCount) => currentCount + 1
      );
    };

    socketClient.on(
      "connect",
      joinNotificationRoom
    );

    socketClient.on(
      "new-notification",
      handleNewNotification
    );

    if (!socketClient.connected) {
      socketClient.connect();
    } else {
      joinNotificationRoom();
    }

    return () => {
      socketClient.off(
        "connect",
        joinNotificationRoom
      );

      socketClient.off(
        "new-notification",
        handleNewNotification
      );
    };
  }, [user?._id]);

  const handleLogout = () => {
    socketClient.disconnect();

    localStorage.removeItem("token");
    localStorage.removeItem("user");

    navigate("/login");
  };

  // Thêm bài mới lên đầu danh sách
  const handlePostCreated = (
    newPost: PostData
  ) => {
    setPosts((currentPosts) => [
      { ...newPost, commentsCount: 0 },
      ...currentPosts,
    ]);
  };

  // Cập nhật bài viết vừa sửa trong danh sách hiện tại
  const handlePostUpdated = (
    updatedPost: PostData
  ) => {
    setPosts((currentPosts) =>
      currentPosts.map((post) =>
        post._id === updatedPost._id
          ? updatedPost
          : post
      )
    );

    setMessage("Cập nhật bài viết thành công");

    window.setTimeout(() => {
      setMessage("");
    }, 2000);
  };

  // Xóa bài viết của chính người đang đăng nhập
  const handleDeletePost = async (
    postId: string
  ) => {
    const isConfirmed = window.confirm(
      "Bạn có chắc chắn muốn xóa bài viết này không?"
    );

    if (!isConfirmed) {
      return;
    }

    try {
      setDeletingPostId(postId);

      await axiosClient.delete(`/posts/${postId}`);

      setPosts((currentPosts) =>
        currentPosts.filter(
          (post) => post._id !== postId
        )
      );

      if (selectedPost?._id === postId) {
        setSelectedPost(null);
      }

      setMessage("Xóa bài viết thành công");

      window.setTimeout(() => {
        setMessage("");
      }, 2000);
    } catch (error: any) {
      setMessage(
        error.response?.data?.message ||
          "Không thể xóa bài viết"
      );
    } finally {
      setDeletingPostId(null);
    }
  };

  // Thích hoặc bỏ thích bài viết
  const handleToggleLike = async (
    postId: string
  ) => {
    try {
      setLikingPostId(postId);

      const response =
        await axiosClient.patch<LikePostResponse>(
          `/posts/${postId}/like`
        );

      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post._id === postId
            ? {
                ...post,
                likes: response.data.likes,
              }
            : post
        )
      );
    } catch (error: any) {
      setMessage(
        error.response?.data?.message ||
          "Không thể thích bài viết"
      );
    } finally {
      setLikingPostId(null);
    }
  };

  const getFirstLetter = () => {
    if (!user?.fullName) {
      return "";
    }

    return user.fullName
      .trim()
      .charAt(0)
      .toUpperCase();
  };

  const renderAvatar = () => {
    if (user?.avatarUrl) {
      return (
        <img
          src={user.avatarUrl}
          alt={`Ảnh đại diện của ${user.fullName}`}
        />
      );
    }

    return getFirstLetter();
  };

  const formatTripDate = (
    dateValue: string
  ) => {
    return new Date(dateValue).toLocaleDateString(
      "vi-VN"
    );
  };

  const formatTripBudget = (budget: number) => {
    if (!budget) {
      return "Chưa cập nhật";
    }

    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(budget);
  };

  // Kiểm tra tài khoản hiện tại đã thích bài viết chưa
  const hasUserLikedPost = (
    post: PostData
  ) => {
    if (!user) {
      return false;
    }

    return post.likes.some(
      (likedUserId) => likedUserId === user._id
    );
  };

  // Luôn lấy dữ liệu mới nhất của bài đang mở
  // để số lượt thích trong cửa sổ cập nhật ngay.
  const currentSelectedPost = selectedPost
    ? posts.find(
        (post) =>
          post._id === selectedPost._id
      ) || selectedPost
    : null;

  // Cập nhật ngay tổng số bình luận của bài viết
  // mà không cần tải lại trang Home.
  const handleCommentsCountChange = (
    postId: string,
    count: number
  ) => {
    setPosts((currentPosts) =>
      currentPosts.map((post) =>
        post._id === postId
          ? {
              ...post,
              commentsCount: count,
            }
          : post
      )
    );
  };
 const handleSharePost = async (
  post: PostData
) => {
  const postUrl =
    `${window.location.origin}/home?post=${post._id}`;

  try {
    const isMobile =
      /Android|iPhone|iPad|iPod/i.test(
        navigator.userAgent
      );

    if (isMobile && navigator.share) {
      await navigator.share({
        title: `Bài viết của ${post.author.fullName}`,
        text: post.content,
        url: postUrl,
      });
    } else {
      await navigator.clipboard.writeText(
        postUrl
      );

      window.alert(
        "Đã sao chép đường dẫn bài viết"
      );
    }

    // Gọi Backend để tăng số lượt chia sẻ
    const response =
      await axiosClient.patch<SharePostResponse>(
        `/posts/${post._id}/share`
      );

    // Cập nhật số ngay trên giao diện
    setPosts((currentPosts) =>
      currentPosts.map((currentPost) =>
        currentPost._id === post._id
          ? {
              ...currentPost,
              sharesCount:
                response.data.sharesCount,
            }
          : currentPost
      )
    );
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return;
    }

    console.error("Lỗi chia sẻ:", error);

    setMessage(
      error.response?.data?.message ||
        "Không thể chia sẻ bài viết"
    );
  }
};
  // Đóng chi tiết và xóa mã bài viết khỏi URL.
  const handleClosePostDetail = () => {
    setSelectedPost(null);

    const currentUrl = new URL(
      window.location.href
    );

    currentUrl.searchParams.delete("post");

    window.history.replaceState(
      {},
      "",
      `${currentUrl.pathname}${currentUrl.search}`
    );
  };

  if (isLoading) {
    return (
      <div className="home-page">
        <p
          style={{
            padding: "40px",
            textAlign: "center",
          }}
        >
          Đang tải thông tin...
        </p>
      </div>
    );
  }

  return (
    <div className="home-page">
      <header className="home-header">
        <div className="header-left">
          <button
            className="hamburger-button"
            type="button"
            aria-label="Mở menu"
            onClick={() =>
              setIsSideMenuOpen(true)
            }
          >
            ☰

            {unreadNotificationCount > 0 && (
              <span className="hamburger-notification-badge">
                {unreadNotificationCount > 99
                  ? "99+"
                  : unreadNotificationCount}
              </span>
            )}
          </button>

          <div className="home-brand">
            Travel Community
          </div>
        </div>

        <nav className="home-navigation">
          <Link className="active" to="/home">
            Trang chủ
          </Link>

          <Link to="/explore">Khám phá</Link>

          <Link to="/trips">Chuyến đi</Link>

          <Link to="/companions">
            Tìm bạn đồng hành
          </Link>
        </nav>

        <div className="header-user">
          <div className="user-avatar">
            {renderAvatar()}
          </div>

          <span>{user?.fullName}</span>
        </div>
      </header>

      {isSideMenuOpen && (
        <div
          className="side-menu-overlay"
          onMouseDown={() =>
            setIsSideMenuOpen(false)
          }
        >
          <aside
            className="side-drawer"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="side-drawer-header">
              <h2>Menu</h2>

              <button
                type="button"
                aria-label="Đóng menu"
                onClick={() =>
                  setIsSideMenuOpen(false)
                }
              >
                ×
              </button>
            </div>

            <div className="drawer-profile">
              <div className="profile-avatar">
                {renderAvatar()}
              </div>

              <h2>{user?.fullName}</h2>
              <p>{user?.email}</p>
            </div>

            <nav className="drawer-menu">
             <button
              type="button"
                onClick={() => {
               setIsSideMenuOpen(false);

              if (user?._id) {
                navigate(`/users/${user._id}`);
              }
               }}
              >
                 <span>👤</span>
                 Trang cá nhân
</button>

              <button
                type="button"
                onClick={() => {
                  setIsSideMenuOpen(false);
                  navigate("/trips");
                }}
              >
                <span>🧳</span>
                Chuyến đi của tôi
              </button>

              <button
                className="notification-menu-button"
                type="button"
                onClick={() => {
                  setIsSideMenuOpen(false);
                  navigate("/trip-invitations");
                }}
              >
                <span>💌</span>
                <span>Lời mời chuyến đi</span>

                {pendingInvitationCount > 0 && (
                  <strong className="notification-menu-badge">
                    {pendingInvitationCount > 99
                      ? "99+"
                      : pendingInvitationCount}
                  </strong>
                )}
              </button>

              <button
                className="notification-menu-button"
                type="button"
                onClick={() => {
                  setIsSideMenuOpen(false);
                  navigate("/notifications");
                }}
              >
                <span>🔔</span>
                <span>Thông báo</span>

                {unreadNotificationCount > 0 && (
                  <strong className="notification-menu-badge">
                    {unreadNotificationCount > 99
                      ? "99+"
                      : unreadNotificationCount}
                  </strong>
                )}
              </button>

              <button type="button">
                <span>⚙️</span>
                Cài đặt
              </button>

              <button
                className="drawer-logout-button"
                type="button"
                onClick={handleLogout}
              >
                <span>↪</span>
                Đăng xuất
              </button>
            </nav>
          </aside>
        </div>
      )}

      <main className="home-content">
        <section className="main-feed">
          <div className="welcome-banner">
            <h1>
              Xin chào, {user?.fullName}! 👋
            </h1>

            <p>
              Hôm nay bạn muốn khám phá địa điểm nào?
              Hãy chia sẻ hành trình của mình với cộng
              đồng.
            </p>
          </div>

          {message && (
            <div className="home-card home-message">
              <p>{message}</p>
            </div>
          )}

          <div className="home-card create-post">
            <div className="create-post-top">
              <div className="user-avatar">
                {renderAvatar()}
              </div>

              <button
                className="post-input"
                type="button"
                onClick={() =>
                  setIsCreatePostOpen(true)
                }
              >
                Bạn đang nghĩ gì về chuyến đi sắp tới?
              </button>
            </div>

            <div className="post-actions">
              <button
                type="button"
                onClick={() =>
                  setIsCreatePostOpen(true)
                }
              >
                📷 Hình ảnh
              </button>

              <button
                type="button"
                onClick={() =>
                  setIsCreatePostOpen(true)
                }
              >
                📍 Địa điểm
              </button>

              <button type="button">
                🗺️ Chuyến đi
              </button>
            </div>
          </div>

          {isLoadingPosts ? (
            <div className="home-card empty-feed">
              <p>Đang tải bài viết...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="home-card empty-feed">
              <div className="empty-feed-icon">
                🌏
              </div>

              <h3>Chưa có bài viết nào</h3>

              <p>
                Hãy trở thành người đầu tiên chia sẻ
                trải nghiệm du lịch với cộng đồng.
              </p>
            </div>
          ) : (
            <div className="post-list">
              {posts.map((post) => (
                <article
                  className="home-card feed-post"
                  key={post._id}
                >
                  <div className="feed-post-header">
                  <Link
              className="feed-post-avatar author-avatar-link"
               to={`/users/${post.author._id}`}
                  title={`Xem trang cá nhân của ${post.author.fullName}`}
            >
               {post.author.avatarUrl ? (
            <img
               src={post.author.avatarUrl}
                  alt={`Ảnh của ${post.author.fullName}`}
             />
             ) : (
                  post.author.fullName
                  .trim()
                  .charAt(0)
                 .toUpperCase()
                )}
            </Link>

                    <div className="feed-post-author">
                      <Link
                      className="author-name-link"
                        to={`/users/${post.author._id}`}
                  >
                        {post.author.fullName}
                        </Link>

                      <div className="feed-post-meta">
                        {new Date(
                          post.createdAt
                        ).toLocaleString("vi-VN")}

                        {post.location && (
                          <>
                            {" · "}📍{" "}
                            {post.location}
                          </>
                        )}
                      </div>

                      {post.postType ===
                        "companion_trip" && (
                        <span className="companion-post-label">
                          🧭 Đang tìm bạn đồng hành
                        </span>
                      )}
                    </div>

                    {user?._id ===
                      post.author._id && (
                      <div className="post-options">
                        <button
                          className="post-options-button"
                          type="button"
                          aria-label="Tùy chọn bài viết"
                          onClick={(event) => {
                            event.stopPropagation();

                            setOpenPostMenuId(
                              (currentId) =>
                                currentId === post._id
                                  ? null
                                  : post._id
                            );
                          }}
                        >
                          ⋯
                        </button>

                        {openPostMenuId ===
                          post._id && (
                          <div className="post-options-menu">
                            {post.postType ===
                              "companion_trip" &&
                            post.trip ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenPostMenuId(null);
                                  navigate(
                                    `/trips/${post.trip?._id}`
                                  );
                                }}
                              >
                                <span>🧳</span>
                                Quản lý chuyến đi
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenPostMenuId(null);
                                    setEditingPost(post);
                                  }}
                                >
                                  <span>✏️</span>
                                  Sửa bài viết
                                </button>

                                <button
                                  className="delete-option"
                                  type="button"
                                  disabled={
                                    deletingPostId ===
                                    post._id
                                  }
                                  onClick={() => {
                                    setOpenPostMenuId(null);
                                    handleDeletePost(
                                      post._id
                                    );
                                  }}
                                >
                                  <span>🗑️</span>

                                  {deletingPostId ===
                                  post._id
                                    ? "Đang xóa..."
                                    : "Xóa bài viết"}
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <p className="feed-post-content">
                    {post.content}
                  </p>

                  {post.imageUrls?.length > 0 && (
                    <div
                      className={`feed-post-images ${
                        post.imageUrls.length === 1
                          ? "one-image"
                          : post.imageUrls.length === 2
                            ? "two-images"
                            : "many-images"
                      }`}
                    >
                      {post.imageUrls.map(
                        (imageUrl, index) => (
                          <img
                            key={`${post._id}-${index}`}
                            src={imageUrl}
                            alt="Ảnh bài viết"
                          />
                        )
                      )}
                    </div>
                  )}

                  {post.postType ===
                    "companion_trip" &&
                    post.trip && (
                    <section className="companion-trip-summary">
                      <div className="companion-trip-heading">
                        <div>
                          <span className="companion-trip-eyebrow">
                            CHUYẾN ĐI ĐANG TUYỂN THÀNH VIÊN
                          </span>

                          <h3>{post.trip.title}</h3>
                        </div>

                        <span
                          className="companion-trip-capacity"
                          style={{
                            width: "fit-content",
                            minWidth: "max-content",
                            maxWidth: "max-content",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flex: "0 0 auto",
                            padding: "9px 16px",
                            margin: 0,
                            color: "#955400",
                            background: "#ffedb5",
                            borderRadius: "999px",
                            fontSize: "17px",
                            fontWeight: 800,
                            lineHeight: 1.15,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {Math.min(
                            post.trip.members.length + 1,
                            post.trip.maxMembers
                          )}
                          /{post.trip.maxMembers} người
                        </span>
                      </div>

                      <div className="companion-trip-information">
                        <span>
                          📍 {post.trip.destination}
                        </span>

                        <span>
                          📅 {formatTripDate(
                            post.trip.startDate
                          )}{" "}
                          - {formatTripDate(
                            post.trip.endDate
                          )}
                        </span>

                        <span>
                          💰 {formatTripBudget(
                            post.trip.budget
                          )}
                        </span>
                      </div>

                      <button
                        className="view-companion-trip-button"
                        type="button"
                        onClick={() =>
                          navigate(
                            `/trips/${post.trip?._id}`
                          )
                        }
                      >
                        Xem chi tiết
                      
                      </button>
                    </section>
                  )}

                  <div className="feed-post-actions compact-actions">
                    <button
                      className={
                        hasUserLikedPost(post)
                          ? "compact-action liked"
                          : "compact-action"
                      }
                      type="button"
                      disabled={
                        likingPostId === post._id
                      }
                      onClick={() =>
                        handleToggleLike(post._id)
                      }
                    >
                      {likingPostId === post._id
                        ? "..."
                        : (
                          <>
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M7 10v11H3V10h4Zm4.3 11H9V10.2l3.8-7.1c.4-.8 1.4-1.2 2.2-.8.7.3 1.1 1.1.9 1.8L15 8h4.3c1.5 0 2.6 1.4 2.2 2.8l-2.1 7.5c-.4 1.6-1.9 2.7-3.5 2.7h-4.6Z" />
                            </svg>
                            <span>{post.likes.length}</span>
                          </>
                        )}
                    </button>

                    <button
                      className="compact-action"
                      type="button"
                      title="Xem bình luận"
                      onClick={() =>
                        setSelectedPost(post)
                      }
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.6 9.6 0 0 1-3.7-.9L3 21l1.7-4.4A8.3 8.3 0 0 1 3 11.5C3 6.8 7 3 12 3s9 3.8 9 8.5Z" />
                      </svg>
                      <span>{post.commentsCount ?? 0}</span>
                    </button>

                  <button
  className="compact-action"
  type="button"
  title="Chia sẻ"
  onClick={() => handleSharePost(post)}
>
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path d="m14 5 7 7-7 7v-4c-5 0-8.5 1.4-11 4 1-5 4-9 11-10V5Z" />
  </svg>

  <span>{post.sharesCount ?? 0}</span>
</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="right-sidebar">
          <section className="home-card suggestion-card">
            <h3>Điểm đến nổi bật</h3>

            <div className="suggestion-item">
              <strong>🏖️ Phú Quốc</strong>

              <span>
                Biển xanh và hoàng hôn tuyệt đẹp
              </span>
            </div>

            <div className="suggestion-item">
              <strong>🌲 Đà Lạt</strong>

              <span>
                Không khí mát mẻ và nhiều cảnh đẹp
              </span>
            </div>

            <div className="suggestion-item">
              <strong>🏮 Hội An</strong>

              <span>
                Phố cổ yên bình và nhiều món ngon
              </span>
            </div>
          </section>

          <section className="home-card ai-card">
            <h3>✨ Trợ lý du lịch AI</h3>

            <p>
              Nhận gợi ý lịch trình, địa điểm, món ăn
              và chi phí phù hợp với bạn.
            </p>

            <button
              className="ai-button"
              type="button"
            >
              Tạo lịch trình
            </button>
          </section>
        </aside>
      </main>

      {isCreatePostOpen && (
        <CreatePostModal
          onClose={() =>
            setIsCreatePostOpen(false)
          }
          onPostCreated={handlePostCreated}
        />
      )}

      {editingPost && (
        <EditPostModal
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onPostUpdated={handlePostUpdated}
        />
      )}

      {currentSelectedPost && user && (
        <PostDetailModal
          post={currentSelectedPost}
          currentUser={user}
          isLiked={hasUserLikedPost(
            currentSelectedPost
          )}
          isLiking={
            likingPostId ===
            currentSelectedPost._id
          }
          onClose={handleClosePostDetail}
          onToggleLike={handleToggleLike}
          onCommentsCountChange={
            handleCommentsCountChange
          }
          onSharePost={handleSharePost}
        />
      )}
    </div>
  );
}

export default HomePage;