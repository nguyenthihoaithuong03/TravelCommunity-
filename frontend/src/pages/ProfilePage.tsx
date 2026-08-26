import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import axiosClient from "../api/axiosClient";
import CommentSection from "../components/CommentSection";
import type { PostData } from "../components/CreatePostModal";
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
  const [openCommentsPostId, setOpenCommentsPostId] =
    useState<string | null>(null);

  const storedUser = localStorage.getItem("user");
  const currentUser: StoredUserData | null = storedUser
    ? JSON.parse(storedUser)
    : null;

  const isOwnProfile = currentUser?._id === userId;

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
          ← Trang chủ
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
          <h2>Bài viết của {profile.fullName}</h2>

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

                  <div className="profile-post-actions">
                    <button
                      className={
                        hasLikedPost(post)
                          ? "profile-post-action liked"
                          : "profile-post-action"
                      }
                      type="button"
                      aria-label="Thích bài viết"
                      title="Thích"
                      disabled={likingPostId === post._id}
                      onClick={() =>
                        handleToggleLikePost(post._id)
                      }
                    >
                      <span>👍</span>
                      {likingPostId === post._id
                        ? "…"
                        : post.likes?.length ?? 0}
                    </button>

                    <button
                      className="profile-post-action"
                      type="button"
                      aria-label="Mở bình luận"
                      title="Bình luận"
                      onClick={() => {
                        const willOpen =
                          openCommentsPostId !== post._id;

                        setOpenCommentsPostId(
                          willOpen ? post._id : null
                        );

                        if (willOpen) {
                          window.setTimeout(() => {
                            document
                              .getElementById(
                                `comment-${post._id}`
                              )
                              ?.focus();
                          }, 0);
                        }
                      }}
                    >
                      <span>💬</span>
                      {post.commentsCount ?? 0}
                    </button>

                    <button
                      className="profile-post-action"
                      type="button"
                      aria-label="Chia sẻ bài viết"
                      title="Chia sẻ"
                      onClick={() => handleSharePost(post)}
                    >
                      <span>↗</span>
                      {post.sharesCount ?? 0}
                    </button>
                  </div>

                  {currentUser?._id &&
                    openCommentsPostId === post._id && (
                      <div className="profile-post-comments">
                        <CommentSection
                          postId={post._id}
                          currentUserId={currentUser._id}
                          currentUserName={
                            currentUser.fullName || "Người dùng"
                          }
                          currentUserAvatar={
                            currentUser.avatarUrl
                          }
                          onCommentsCountChange={(count) =>
                            handleCommentsCountChange(
                              post._id,
                              count
                            )
                          }
                        />
                      </div>
                    )}
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
    </div>
  );
}

export default PublicProfilePage;