import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

import axiosClient from "../api/axiosClient";

interface SearchUserData {
  _id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  hometown?: string;
}

interface SearchUsersResponse {
  success: boolean;
  users: SearchUserData[];
}

interface InviteTripMemberModalProps {
  tripId: string;
  existingMemberIds: string[];
  onClose: () => void;
}

function InviteTripMemberModal({
  tripId,
  existingMemberIds,
  onClose,
}: InviteTripMemberModalProps) {
  const [keyword, setKeyword] = useState("");
  const [users, setUsers] = useState<
    SearchUserData[]
  >([]);
  const [selectedUser, setSelectedUser] =
    useState<SearchUserData | null>(null);
  const [invitationMessage, setInvitationMessage] =
    useState("");
  const [isSearching, setIsSearching] =
    useState(false);
  const [isSending, setIsSending] =
    useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] =
    useState("");

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

  const handleSearch = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const trimmedKeyword = keyword.trim();

    if (trimmedKeyword.length < 2) {
      setErrorMessage(
        "Hãy nhập ít nhất 2 ký tự"
      );
      setUsers([]);
      return;
    }

    try {
      setIsSearching(true);
      setErrorMessage("");
      setMessage("");
      setSelectedUser(null);

      const response =
        await axiosClient.get<SearchUsersResponse>(
          "/users/search",
          {
            params: {
              keyword: trimmedKeyword,
            },
          }
        );

      const availableUsers =
        response.data.users.filter(
          (user) =>
            !existingMemberIds.includes(user._id)
        );

      setUsers(availableUsers);

      if (availableUsers.length === 0) {
        setMessage(
          "Không tìm thấy tài khoản phù hợp hoặc người này đã tham gia chuyến đi"
        );
      }
    } catch (error: any) {
      setErrorMessage(
        error.response?.data?.message ||
          "Không thể tìm kiếm tài khoản"
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendInvitation = async () => {
    if (!selectedUser) {
      setErrorMessage(
        "Hãy chọn người bạn muốn mời"
      );
      return;
    }

    try {
      setIsSending(true);
      setErrorMessage("");
      setMessage("");

      await axiosClient.post(
        `/trip-invitations/trips/${tripId}`,
        {
          recipientId: selectedUser._id,
          message: invitationMessage.trim(),
        }
      );

      setMessage(
        `Đã gửi lời mời đến ${selectedUser.fullName}`
      );

      setUsers((currentUsers) =>
        currentUsers.filter(
          (user) =>
            user._id !== selectedUser._id
        )
      );

      setSelectedUser(null);
      setInvitationMessage("");
    } catch (error: any) {
      setErrorMessage(
        error.response?.data?.message ||
          "Không thể gửi lời mời"
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      className="invite-member-overlay"
      onMouseDown={onClose}
    >
      <section
        className="invite-member-modal"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <header className="invite-member-header">
          <div>
            <h2>Mời thành viên</h2>
            <p>
              Tìm kiếm tài khoản bằng tên hoặc email.
            </p>
          </div>

          <button
            type="button"
            aria-label="Đóng"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <form
          className="invite-search-form"
          onSubmit={handleSearch}
        >
          <input
            value={keyword}
            onChange={(event) =>
              setKeyword(event.target.value)
            }
            placeholder="Nhập tên hoặc email..."
          />

          <button
            type="submit"
            disabled={isSearching}
          >
            {isSearching
              ? "Đang tìm..."
              : "Tìm kiếm"}
          </button>
        </form>

        {errorMessage && (
          <div className="invite-message error">
            {errorMessage}
          </div>
        )}

        {message && (
          <div className="invite-message success">
            {message}
          </div>
        )}

        <div className="invite-user-list">
          {users.map((user) => (
            <button
              className={
                selectedUser?._id === user._id
                  ? "invite-user-item selected"
                  : "invite-user-item"
              }
              type="button"
              key={user._id}
              onClick={() => {
                setSelectedUser(user);
                setErrorMessage("");
              }}
            >
              <div className="invite-user-avatar">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.fullName}
                  />
                ) : (
                  getFirstLetter(user.fullName)
                )}
              </div>

              <div className="invite-user-info">
                <strong>{user.fullName}</strong>
                <span>{user.email}</span>

                {user.hometown && (
                  <small>
                    📍 {user.hometown}
                  </small>
                )}
              </div>

              <span className="invite-select-icon">
                {selectedUser?._id === user._id
                  ? "✓"
                  : ""}
              </span>
            </button>
          ))}
        </div>

        {selectedUser && (
          <div className="invitation-message-field">
            <label htmlFor="invitation-message">
              Lời nhắn
            </label>

            <textarea
              id="invitation-message"
              rows={3}
              maxLength={300}
              value={invitationMessage}
              onChange={(event) =>
                setInvitationMessage(
                  event.target.value
                )
              }
              placeholder={`Mời ${selectedUser.fullName} tham gia chuyến đi...`}
            />

            <small>
              {invitationMessage.length}/300
            </small>
          </div>
        )}

        <footer className="invite-member-actions">
          <button
            type="button"
            onClick={onClose}
          >
            Đóng
          </button>

          <button
            className="send-invitation-button"
            type="button"
            disabled={!selectedUser || isSending}
            onClick={handleSendInvitation}
          >
            {isSending
              ? "Đang gửi..."
              : "Gửi lời mời"}
          </button>
        </footer>
      </section>
    </div>
  );
}

export default InviteTripMemberModal;