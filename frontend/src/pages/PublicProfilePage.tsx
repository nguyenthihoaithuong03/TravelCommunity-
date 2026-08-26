import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import axiosClient from "../api/axiosClient";
import CreatePostModal, {
  type PostData,
} from "../components/CreatePostModal";
import PostDetailModal from "../components/PostDetailModal";
import "../styles/home.css";
import "../styles/publicProfile.css";

interface PublicUserData {
  _id: string;
  fullName: string;
  avatarUrl?: string;
  bio?: string;
  hometown?: string;
  travelInterests?: string[];
  travelStyle?: string;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  createdAt: string;
}

interface UserProfileResponse {
  success: boolean;
  user: PublicUserData;
}

interface FollowResponse {
  success: boolean;
  message: string;
  isFollowing: boolean;
  followersCount: number;
}

type ProfilePostData = PostData & {
  commentsCount?: number;
  sharesCount?: number;
};

interface UserPostsResponse {
  success: boolean;
  posts: ProfilePostData[];
}

interface ConnectionUser {
  _id: string;
  fullName: string;
  avatarUrl?: string;
  bio?: string;
  hometown?: string;
}

interface ConnectionsResponse {
  success: boolean;
  followers: ConnectionUser[];
  following: ConnectionUser[];
}

interface StoredUserData {
  _id?: string;
  fullName?: string;
  avatarUrl?: string;
}

interface LikePostResponse {
  success: boolean;
  likes: string[];
}

interface SharePostResponse {
  success: boolean;
  sharesCount: number;
}

function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const [profile, setProfile] =
    useState<PublicUserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [message, setMessage] = useState("");
  const [posts, setPosts] =
    useState<ProfilePostData[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] =
    useState(true);
  const [postsMessage, setPostsMessage] =
    useState("");
  const [connectionType, setConnectionType] =
    useState<"followers" | "following" | null>(null);
  const [connections, setConnections] =
    useState<ConnectionUser[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] =
    useState(false);
  const [connectionsMessage, setConnectionsMessage] =
    useState("");
  const [likingPostId, setLikingPostId] =
    useState<string | null>(null);
  const [selectedPost, setSelectedPost] =
    useState<ProfilePostData | null>(null);
  const [isCreatePostOpen, setIsCreatePostOpen] =
    useState(false);

  const storedUser = localStorage.getItem("user");
  const currentUser: StoredUserData | null = storedUser
    ? JSON.parse(storedUser)
    : null;

  const isOwnProfile = currentUser?._id === userId;

  const currentSelectedPost = selectedPost
    ? posts.find(
        (post) => post._id === selectedPost._id
      ) || selectedPost
    : null;

  useEffect(() => {
    const getProfile = async () => {
      if (!userId) {
        setMessage("Mã người dùng không hợp lệ");
        setIsLoading(false);
        return;
      }

      try {
        const response =
          await axiosClient.get<UserProfileResponse>(
            `/users/${userId}`
          );

        setProfile(response.data.user);
      } catch (error: any) {
        setMessage(
          error.response?.data?.message ||
            "Không thể lấy hồ sơ người dùng"
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

    getProfile();
  }, [navigate, userId]);

  useEffect(() => {
    const getUserPosts = async () => {
      if (!userId) {
        setIsLoadingPosts(false);
        return;
      }

      try {
        const response =
          await axiosClient.get<UserPostsResponse>(
            `/posts/user/${userId}`
          );

        setPosts(
          [...response.data.posts].sort(
            (firstPost, secondPost) =>
              new Date(secondPost.createdAt).getTime() -
              new Date(firstPost.createdAt).getTime()
          )
        );
      } catch (error: any) {
        setPostsMessage(
          error.response?.data?.message ||
            "Không thể lấy bài viết"
        );
      } finally {
        setIsLoadingPosts(false);
      }
    };

    getUserPosts();
  }, [userId]);

  const handleToggleFollow = async () => {
    if (!userId || isFollowing) {
      return;
    }

    try {
      setIsFollowing(true);
      setMessage("");

      const response =
        await axiosClient.patch<FollowResponse>(
          `/users/${userId}/follow`
        );

      setProfile((currentProfile) =>
        currentProfile
          ? {
              ...currentProfile,
              isFollowing: response.data.isFollowing,
              followersCount:
                response.data.followersCount,
            }
          : currentProfile
      );

      setMessage(response.data.message);

      window.setTimeout(() => {
        setMessage("");
      }, 2000);
    } catch (error: any) {
      setMessage(
        error.response?.data?.message ||
          "Không thể thực hiện theo dõi"
      );
    } finally {
      setIsFollowing(false);
    }
  };

  const handleOpenConnections = async (
    type: "followers" | "following"
  ) => {
    if (!userId) {
      return;
    }

    try {
      setConnectionType(type);
      setConnections([]);
      setConnectionsMessage("");
      setIsLoadingConnections(true);

      const response =
        await axiosClient.get<ConnectionsResponse>(
          `/users/${userId}/connections`
        );

      setConnections(response.data[type]);
    } catch (error: any) {
      setConnectionsMessage(
        error.response?.data?.message ||
          "Không thể lấy danh sách theo dõi"
      );
    } finally {
      setIsLoadingConnections(false);
    }
  };

  const handleCloseConnections = () => {
    setConnectionType(null);
    setConnections([]);
    setConnectionsMessage("");
  };

  const getFirstLetter = (fullName: string) => {
    return fullName.trim().charAt(0).toUpperCase() || "U";
  };

  const formatTripDate = (date: string) => {
    return new Date(date).toLocaleDateString("vi-VN");
  };

  const formatTripBudget = (budget: number) => {
    return `${budget.toLocaleString("vi-VN")} đ`;
  };

  const hasLikedPost = (post: ProfilePostData) => {
    if (!currentUser?._id) {
      return false;
    }

    return post.likes.some(
      (likedUserId) => likedUserId === currentUser._id
    );
  };

  const handleToggleLikePost = async (postId: string) => {
    try {
      setLikingPostId(postId);

      const response =
        await axiosClient.patch<LikePostResponse>(
          `/posts/${postId}/like`
        );

      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post._id === postId
            ? { ...post, likes: response.data.likes }
            : post
        )
      );
    } catch (error: any) {
      setPostsMessage(
        error.response?.data?.message ||
          "Không thể thích bài viết"
      );
    } finally {
      setLikingPostId(null);
    }
  };

  const handleCommentsCountChange = (
    postId: string,
    count: number
  ) => {
    setPosts((currentPosts) =>
      currentPosts.map((post) =>
        post._id === postId
          ? { ...post, commentsCount: count }
          : post
      )
    );
  };

  const handleSharePost = async (post: ProfilePostData) => {
    const postUrl =
      `${window.location.origin}/home?post=${post._id}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Bài viết của ${post.author.fullName}`,
          text: post.content,
          url: postUrl,
        });
      } else {
        await navigator.clipboard.writeText(postUrl);
        window.alert("Đã sao chép đường dẫn bài viết");
      }

      const response =
        await axiosClient.patch<SharePostResponse>(
          `/posts/${post._id}/share`
        );

      setPosts((currentPosts) =>
        currentPosts.map((currentPost) =>
          currentPost._id === post._id
            ? {
                ...currentPost,
                sharesCount: response.data.sharesCount,
              }
            : currentPost
        )
      );
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        setPostsMessage(
          error.response?.data?.message ||
            "Không thể chia sẻ bài viết"
        );
      }
    }
  };

  if (isLoading) {
    return (
      <div className="public-profile-status">
        Đang tải hồ sơ...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="public-profile-status">
        <p>{message || "Không tìm thấy người dùng"}</p>
        <Link to="/home">Quay lại trang chủ</Link>
      </div>
    );
  }

  return (
    <div className="public-profile-page">
      <header className="public-profile-header">
        <Link className="public-profile-brand" to="/home">
          Travel Community
        </Link>

        <Link className="back-home-link" to="/home">
          Trang chủ
        </Link>
      </header>

      <main className="public-profile-container">
        <section className="public-profile-cover">
          <div className="public-profile-avatar">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={`Ảnh đại diện của ${profile.fullName}`}
              />
            ) : (
              getFirstLetter(profile.fullName)
            )}
          </div>
        </section>

        <section className="public-profile-summary">
          <div>
            <h1>{profile.fullName}</h1>

            <div className="public-profile-counts">
              <button
                type="button"
                onClick={() =>
                  handleOpenConnections("followers")
                }
              >
                <strong>{profile.followersCount}</strong>{" "}
                người theo dõi
              </button>

              <button
                type="button"
                onClick={() =>
                  handleOpenConnections("following")
                }
              >
                <strong>{profile.followingCount}</strong>{" "}
                đang theo dõi
              </button>
            </div>
          </div>

          {isOwnProfile ? (
            <button
              type="button"
              onClick={() => navigate("/profile")}
            >
              Chỉnh sửa hồ sơ
            </button>
          ) : (
            <button
              className={
                profile.isFollowing
                  ? "follow-button following"
                  : "follow-button"
              }
              type="button"
              disabled={isFollowing}
              onClick={handleToggleFollow}
            >
              {isFollowing
                ? "Đang xử lý..."
                : profile.isFollowing
                  ? "Đang theo dõi"
                  : "+ Theo dõi"}
            </button>
          )}
        </section>

        {message && (
          <div className="public-profile-message">
            {message}
          </div>
        )}

        <nav
          className="public-profile-tabs"
          aria-label="Các phần của trang cá nhân"
        >
          <a className="active" href="#profile-posts">
            Bài viết
          </a>
          <a href="#profile-about">Giới thiệu</a>
          <a href="#profile-interests">Sở thích</a>
        </nav>

        <div className="public-profile-body">
        <section className="public-profile-grid">
          <article
            className="public-profile-card"
            id="profile-about"
          >
            <h2>Giới thiệu</h2>

            <p>
              {profile.bio ||
                "Người dùng chưa thêm phần giới thiệu."}
            </p>

            {profile.hometown && (
              <p>🏠 Đến từ {profile.hometown}</p>
            )}

            {profile.travelStyle && (
              <p>🎒 Phong cách: {profile.travelStyle}</p>
            )}

            <p>
              📅 Tham gia từ{" "}
              {new Date(profile.createdAt).toLocaleDateString(
                "vi-VN"
              )}
            </p>
          </article>

          <article
            className="public-profile-card"
            id="profile-interests"
          >
            <h2>Sở thích du lịch</h2>

            {profile.travelInterests?.length ? (
              <div className="travel-interest-list">
                {profile.travelInterests.map((interest) => (
                  <span key={interest}>{interest}</span>
                ))}
              </div>
            ) : (
              <p>Chưa cập nhật sở thích du lịch.</p>
            )}
          </article>
        </section>

        <section
          className="public-profile-posts"
          id="profile-posts"
        >
          {isOwnProfile && (
            <article className="profile-composer">
              <div className="profile-composer-top">
                <div className="profile-post-avatar">
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={profile.fullName}
                    />
                  ) : (
                    getFirstLetter(profile.fullName)
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsCreatePostOpen(true)}
                >
                  Bạn đang nghĩ gì?
                </button>
              </div>

              <div className="profile-composer-actions">
                <button
                  type="button"
                  onClick={() => setIsCreatePostOpen(true)}
                >
                  🖼️ Ảnh/video
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatePostOpen(true)}
                >
                  📍 Địa điểm
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/trips")}
                >
                  🗺️ Chuyến đi
                </button>
              </div>
            </article>
          )}

          <div className="profile-posts-toolbar">
            <h2>Bài viết</h2>

            {isOwnProfile && (
              <button
                type="button"
                onClick={() => setIsCreatePostOpen(true)}
              >
                + Tạo bài viết
              </button>
            )}
          </div>

          {isLoadingPosts ? (
            <div className="profile-post-status">
              Đang tải bài viết...
            </div>
          ) : postsMessage ? (
            <div className="profile-post-status error">
              {postsMessage}
            </div>
          ) : posts.length === 0 ? (
            <div className="profile-post-status">
              Người dùng chưa có bài viết nào.
            </div>
          ) : (
            <div className="public-profile-post-list">
              {posts.map((post) => (
                <article
                  className="public-profile-post-card"
                  key={post._id}
                >
                  <div className="profile-post-header">
                    <div className="profile-post-avatar">
                      {profile.avatarUrl ? (
                        <img
                          src={profile.avatarUrl}
                          alt={profile.fullName}
                        />
                      ) : (
                        getFirstLetter(profile.fullName)
                      )}
                    </div>

                    <div>
                      <strong>{profile.fullName}</strong>
                      <p>
                        {new Date(
                          post.createdAt
                        ).toLocaleString("vi-VN")}

                        {post.location && (
                          <> {" · "}📍 {post.location}</>
                        )}
                      </p>

                      {post.postType ===
                        "companion_trip" && (
                        <span className="companion-post-label">
                          🧭 Đang tìm bạn đồng hành
                        </span>
                      )}
                    </div>
                  </div>

                  {post.content && (
                    <p className="profile-post-content">
                      {post.content}
                    </p>
                  )}

                  {post.imageUrls?.length > 0 && (
                    <div
                      className={
                        post.imageUrls.length === 1
                          ? "profile-post-images one"
                          : "profile-post-images many"
                      }
                    >
                      {post.imageUrls.map(
                        (imageUrl, index) => (
                          <img
                            key={`${post._id}-${index}`}
                            src={imageUrl}
                            alt={`Ảnh bài viết ${index + 1}`}
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
                          navigate(`/trips/${post.trip?._id}`)
                        }
                      >
                        Xem chi tiết
                      </button>
                    </section>
                  )}

                <div className="feed-post-actions compact-actions">
  {/* Thích */}
  <button
    className={
      hasLikedPost(post)
        ? "compact-action liked"
        : "compact-action"
    }
    type="button"
    aria-label="Thích bài viết"
    aria-pressed={hasLikedPost(post)}
    disabled={likingPostId === post._id}
    onClick={() =>
      handleToggleLikePost(post._id)
    }
  >
    {likingPostId === post._id ? (
      <span>...</span>
    ) : (
      <>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 10v11H3V10h4Zm4.3 11H9V10.2l3.8-7.1c.4-.8 1.4-1.2 2.2-.8.7.3 1.1 1.1.9 1.8L15 8h4.3c1.5 0 2.6 1.4 2.2 2.8l-2.1 7.5c-.4 1.6-1.9 2.7-3.5 2.7h-4.6Z" />
        </svg>

        <span>{post.likes?.length ?? 0}</span>
      </>
    )}
  </button>

  {/* Bình luận */}
  <button
    className="compact-action"
    type="button"
    title="Xem bình luận"
    onClick={() => setSelectedPost(post)}
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
    onClick={() => setSelectedPost(post)}
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
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
        </div>
      </main>

      {connectionType && (
        <div
          className="connections-overlay"
          onMouseDown={handleCloseConnections}
        >
          <section
            className="connections-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <header className="connections-header">
              <h2>
                {connectionType === "followers"
                  ? "Người theo dõi"
                  : "Đang theo dõi"}
              </h2>

              <button
                type="button"
                aria-label="Đóng"
                onClick={handleCloseConnections}
              >
                ×
              </button>
            </header>

            <div className="connections-list">
              {isLoadingConnections ? (
                <p className="connections-status">
                  Đang tải danh sách...
                </p>
              ) : connectionsMessage ? (
                <p className="connections-status error">
                  {connectionsMessage}
                </p>
              ) : connections.length === 0 ? (
                <p className="connections-status">
                  Chưa có tài khoản nào.
                </p>
              ) : (
                connections.map((connection) => (
                  <Link
                    className="connection-item"
                    to={`/users/${connection._id}`}
                    key={connection._id}
                    onClick={handleCloseConnections}
                  >
                    <div className="connection-avatar">
                      {connection.avatarUrl ? (
                        <img
                          src={connection.avatarUrl}
                          alt={connection.fullName}
                        />
                      ) : (
                        getFirstLetter(
                          connection.fullName
                        )
                      )}
                    </div>

                    <div>
                      <strong>{connection.fullName}</strong>

                      <p>
                        {connection.bio ||
                          (connection.hometown
                            ? `Đến từ ${connection.hometown}`
                            : "Thành viên Travel Community")}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {currentSelectedPost && currentUser?._id && (
        <PostDetailModal
          post={currentSelectedPost}
          currentUser={{
            _id: currentUser._id,
            fullName:
              currentUser.fullName || "Người dùng",
            ...(currentUser.avatarUrl
              ? { avatarUrl: currentUser.avatarUrl }
              : {}),
          }}
          isLiked={hasLikedPost(currentSelectedPost)}
          isLiking={
            likingPostId === currentSelectedPost._id
          }
          onClose={() => setSelectedPost(null)}
          onToggleLike={handleToggleLikePost}
          onCommentsCountChange={
            handleCommentsCountChange
          }
          onSharePost={handleSharePost}
        />
      )}

      {isCreatePostOpen && (
        <CreatePostModal
          onClose={() => setIsCreatePostOpen(false)}
          onPostCreated={(newPost) =>
            setPosts((currentPosts) => [
              {
                ...newPost,
                commentsCount: 0,
              },
              ...currentPosts,
            ])
          }
        />
      )}
    </div>
  );
}

export default PublicProfilePage;