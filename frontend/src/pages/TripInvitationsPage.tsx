import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
} from "react-router-dom";

import axiosClient from "../api/axiosClient";
import "../styles/tripInvitations.css";

type InvitationStatus =
  | "pending"
  | "accepted"
  | "rejected";

type RequestType =
  | "invite"
  | "join_request";

interface InvitationUser {
  _id: string;
  fullName: string;
  avatarUrl?: string;
}

interface InvitationTrip {
  _id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  coverImageUrl?: string;
  status: string;
  isActive: boolean;
}

interface TripInvitationData {
  _id: string;
  trip: InvitationTrip | null;
  sender: InvitationUser;
  recipient: InvitationUser;
  requestType?: RequestType;
  status: InvitationStatus;
  message: string;
  createdAt: string;
}

interface InvitationsResponse {
  success: boolean;
  invitations: TripInvitationData[];
}

interface RespondInvitationResponse {
  success: boolean;
  message: string;
  invitation: TripInvitationData;
  tripId?: string;
}

const statusLabels: Record<
  InvitationStatus,
  string
> = {
  pending: "Đang chờ",
  accepted: "Đã đồng ý",
  rejected: "Đã từ chối",
};

function TripInvitationsPage() {
  const navigate = useNavigate();

  const [invitations, setInvitations] =
    useState<TripInvitationData[]>([]);
  const [isLoading, setIsLoading] =
    useState(true);
  const [processingId, setProcessingId] =
    useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    const getInvitations = async () => {
      try {
        setIsLoading(true);

        const response =
          await axiosClient.get<InvitationsResponse>(
            "/trip-invitations/my"
          );

        setInvitations(
          response.data.invitations
        );
      } catch (error: any) {
        setErrorMessage(
          error.response?.data?.message ||
            "Không thể lấy lời mời chuyến đi"
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

    void getInvitations();
  }, [navigate]);

  const getFirstLetter = (fullName: string) => {
    return (
      fullName.trim().charAt(0).toUpperCase() ||
      "U"
    );
  };

  const formatDate = (dateValue: string) => {
    return new Date(dateValue).toLocaleDateString(
      "vi-VN"
    );
  };

  const handleRespond = async (
    invitation: TripInvitationData,
    action: "accept" | "reject"
  ) => {
    try {
      setProcessingId(invitation._id);
      setMessage("");
      setErrorMessage("");

      const response =
        await axiosClient.patch<RespondInvitationResponse>(
          `/trip-invitations/${invitation._id}/respond`,
          { action }
        );

      setInvitations((currentInvitations) =>
        currentInvitations.map(
          (currentInvitation) =>
            currentInvitation._id ===
            invitation._id
              ? response.data.invitation
              : currentInvitation
        )
      );

      setMessage(response.data.message);
    } catch (error: any) {
      setErrorMessage(
        error.response?.data?.message ||
          "Không thể xử lý lời mời"
      );
    } finally {
      setProcessingId(null);
    }
  };

  const pendingCount = invitations.filter(
    (invitation) =>
      invitation.status === "pending"
  ).length;

  return (
    <div className="trip-invitations-page">
      <header className="trip-invitations-header">
        <Link to="/home">Travel Community</Link>

        <button
          type="button"
          onClick={() => navigate("/home")}
        >
          Trang chủ
        </button>
      </header>

      <main className="trip-invitations-container">
        <section className="trip-invitations-title">
          <div>
            <span>LỜI MỜI & YÊU CẦU</span>
            <h1>Chuyến đi của bạn</h1>
            <p>
              {pendingCount} mục đang chờ bạn phản hồi
            </p>
          </div>
          <div className="trip-invitations-title-icon">
            🧳
          </div>
        </section>

        {message && (
          <div className="trip-invitations-alert success">
            {message}
          </div>
        )}

        {errorMessage && (
          <div className="trip-invitations-alert error">
            {errorMessage}
          </div>
        )}

        {isLoading ? (
          <div className="trip-invitations-empty">
            Đang tải dữ liệu...
          </div>
        ) : invitations.length === 0 ? (
          <div className="trip-invitations-empty">
            <span>📭</span>
            <h2>Chưa có lời mời hoặc yêu cầu</h2>
            <p>
              Các lời mời và yêu cầu tham gia mới sẽ
              xuất hiện tại đây.
            </p>
          </div>
        ) : (
          <div className="trip-invitations-list">
            {invitations.map((invitation) => {
              const isJoinRequest =
                invitation.requestType ===
                "join_request";

              return (
                <article
                  className={`trip-invitation-card ${invitation.status}`}
                  key={invitation._id}
                >
                  <div className="invitation-user-avatar">
                    {invitation.sender.avatarUrl ? (
                      <img
                        src={invitation.sender.avatarUrl}
                        alt={invitation.sender.fullName}
                      />
                    ) : (
                      getFirstLetter(
                        invitation.sender.fullName
                      )
                    )}
                  </div>

                  <div className="invitation-main-content">
                    <div className="invitation-card-heading">
                      <div>
                        <span className="invitation-kind">
                          {isJoinRequest
                            ? "YÊU CẦU THAM GIA"
                            : "LỜI MỜI CHUYẾN ĐI"}
                        </span>

                        <h2>
                          {isJoinRequest
                            ? `${invitation.sender.fullName} muốn tham gia chuyến đi của bạn`
                            : `${invitation.sender.fullName} đã mời bạn tham gia`}
                        </h2>
                      </div>

                      <span
                        className={`invitation-status ${invitation.status}`}
                      >
                        {statusLabels[invitation.status]}
                      </span>
                    </div>

                    {invitation.trip ? (
                      <Link
                        className="invitation-trip-information"
                        to={`/trips/${invitation.trip._id}`}
                      >
                        {invitation.trip.coverImageUrl ? (
                          <img
                            src={
                              invitation.trip.coverImageUrl
                            }
                            alt={invitation.trip.title}
                          />
                        ) : (
                          <div>🗺️</div>
                        )}

                        <span>
                          <strong>
                            {invitation.trip.title}
                          </strong>
                          <small>
                            📍 {invitation.trip.destination}
                          </small>
                          <small>
                            📅 {formatDate(
                              invitation.trip.startDate
                            )}{" "}
                            - {formatDate(
                              invitation.trip.endDate
                            )}
                          </small>
                        </span>
                      </Link>
                    ) : (
                      <p className="invitation-trip-missing">
                        Chuyến đi không còn tồn tại.
                      </p>
                    )}

                    {invitation.message && (
                      <p className="invitation-message">
                        “{invitation.message}”
                      </p>
                    )}

                    <time>
                      {new Date(
                        invitation.createdAt
                      ).toLocaleString("vi-VN")}
                    </time>

                    {invitation.status ===
                      "pending" &&
                      invitation.trip && (
                      <div className="invitation-actions">
                        <button
                          className="reject-invitation-button"
                          type="button"
                          disabled={
                            processingId ===
                            invitation._id
                          }
                          onClick={() =>
                            handleRespond(
                              invitation,
                              "reject"
                            )
                          }
                        >
                          Từ chối
                        </button>

                        <button
                          className="accept-invitation-button"
                          type="button"
                          disabled={
                            processingId ===
                            invitation._id
                          }
                          onClick={() =>
                            handleRespond(
                              invitation,
                              "accept"
                            )
                          }
                        >
                          {processingId ===
                          invitation._id
                            ? "Đang xử lý..."
                            : isJoinRequest
                              ? "Chấp nhận thành viên"
                              : "Đồng ý tham gia"}
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default TripInvitationsPage;