import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";

import axiosClient from "../api/axiosClient";
import socketClient from "../socketClient";
import "../styles/notifications.css";

type NotificationType =
  | "follow"
  | "like_post"
  | "comment"
  | "reply";

interface NotificationSender {
  _id: string;
  fullName: string;
  avatarUrl?: string;
}

interface NotificationData {
  _id: string;
  recipient: string;
  sender: NotificationSender;
  type: NotificationType;
  post: string | null;
  comment: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  success: boolean;
  notifications: NotificationData[];
}

interface ReadNotificationResponse {
  success: boolean;
  notification: NotificationData;
}

function NotificationsPage() {
  const navigate = useNavigate();

  const [notifications, setNotifications] =
    useState<NotificationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReadingAll, setIsReadingAll] = useState(false);
  const [message, setMessage] = useState("");

  const getNotifications = useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) {
          setIsLoading(true);
        }

        const response =
          await axiosClient.get<NotificationsResponse>(
            "/notifications"
          );

        setNotifications(response.data.notifications);

        setMessage("");
      } catch (error: any) {
        setMessage(
          error.response?.data?.message ||
            "Không thể lấy thông báo"
        );

        if (error.response?.status === 401) {
          socketClient.disconnect();

          localStorage.removeItem("token");
          localStorage.removeItem("user");

          navigate("/login");
        }
      } finally {
        if (showLoading) {
          setIsLoading(false);
        }
      }
    },
    [navigate]
  );

  // Lấy danh sách khi mở trang.
  useEffect(() => {
    void getNotifications();
  }, [getNotifications]);

  // Nhận thông báo mới ngay khi đang mở trang.
  useEffect(() => {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      return;
    }

    let currentUserId = "";

    try {
      const parsedUser = JSON.parse(storedUser) as {
        _id?: string;
      };

      currentUserId = parsedUser._id || "";
    } catch (error) {
      console.error(
        "Thông tin người dùng không hợp lệ:",
        error
      );

      return;
    }

    if (!currentUserId) {
      return;
    }

    const joinNotificationRoom = () => {
      socketClient.emit(
        "join-user",
        currentUserId
      );
    };

    const handleNewNotification = () => {
      /*
       * Lấy lại từ API để sender được populate
       * đầy đủ tên và ảnh đại diện, đồng thời
       * tránh chèn trùng thông báo.
       */
      void getNotifications(false);
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
  }, [getNotifications]);

  const getFirstLetter = (fullName: string) => {
    return fullName.trim().charAt(0).toUpperCase() || "U";
  };

  const getNotificationIcon = (
    type: NotificationType
  ) => {
    switch (type) {
      case "follow":
        return "👤";
      case "like_post":
        return "👍";
      case "comment":
        return "💬";
      case "reply":
        return "↩️";
      default:
        return "🔔";
    }
  };

  const handleOpenNotification = async (
    notification: NotificationData
  ) => {
    try {
      if (!notification.isRead) {
        const response =
          await axiosClient.patch<ReadNotificationResponse>(
            `/notifications/${notification._id}/read`
          );

        setNotifications((currentNotifications) =>
          currentNotifications.map((currentNotification) =>
            currentNotification._id === notification._id
              ? response.data.notification
              : currentNotification
          )
        );
      }

      if (notification.type === "follow") {
        navigate(`/users/${notification.sender._id}`);
        return;
      }

      if (notification.post) {
        navigate(`/home?post=${notification.post}`);
      }
    } catch (error: any) {
      setMessage(
        error.response?.data?.message ||
          "Không thể mở thông báo"
      );
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setIsReadingAll(true);

      await axiosClient.patch(
        "/notifications/read-all"
      );

      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) => ({
          ...notification,
          isRead: true,
        }))
      );
    } catch (error: any) {
      setMessage(
        error.response?.data?.message ||
          "Không thể đánh dấu thông báo"
      );
    } finally {
      setIsReadingAll(false);
    }
  };

  const unreadCount = notifications.filter(
    (notification) => !notification.isRead
  ).length;

  return (
    <div className="notifications-page">
      <header className="notifications-header">
        <Link to="/home">Travel Community</Link>

        <button
          type="button"
          onClick={() => navigate("/home")}
        >
          Trang chủ
        </button>
      </header>

      <main className="notifications-container">
        <div className="notifications-title-row">
          <div>
            <h1>Thông báo</h1>
            <p>{unreadCount} thông báo chưa đọc</p>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              disabled={isReadingAll}
              onClick={handleMarkAllAsRead}
            >
              {isReadingAll
                ? "Đang xử lý..."
                : "Đánh dấu tất cả đã đọc"}
            </button>
          )}
        </div>

        {message && (
          <div className="notifications-message">
            {message}
          </div>
        )}

        {isLoading ? (
          <div className="notifications-status">
            Đang tải thông báo...
          </div>
        ) : notifications.length === 0 ? (
          <div className="notifications-empty">
            <span>🔔</span>
            <h2>Chưa có thông báo</h2>
            <p>
              Các hoạt động mới sẽ xuất hiện tại đây.
            </p>
          </div>
        ) : (
          <section className="notifications-list">
            {notifications.map((notification) => (
              <button
                className={
                  notification.isRead
                    ? "notification-item"
                    : "notification-item unread"
                }
                type="button"
                key={notification._id}
                onClick={() =>
                  handleOpenNotification(notification)
                }
              >
                <div className="notification-avatar">
                  {notification.sender.avatarUrl ? (
                    <img
                      src={notification.sender.avatarUrl}
                      alt={notification.sender.fullName}
                    />
                  ) : (
                    getFirstLetter(
                      notification.sender.fullName
                    )
                  )}

                  <span className="notification-type-icon">
                    {getNotificationIcon(notification.type)}
                  </span>
                </div>

                <div className="notification-content">
                  <p>{notification.message}</p>
                  <time>
                    {new Date(
                      notification.createdAt
                    ).toLocaleString("vi-VN")}
                  </time>
                </div>

                {!notification.isRead && (
                  <span className="unread-dot" />
                )}
              </button>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

export default NotificationsPage;