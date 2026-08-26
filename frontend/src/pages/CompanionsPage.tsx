import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Link,
  useNavigate,
} from "react-router-dom";

import axiosClient from "../api/axiosClient";
import "../styles/companions.css";

interface CompanionOwner {
  _id: string;
  fullName: string;
  avatarUrl?: string;
}

interface CompanionMember {
  _id: string;
  fullName: string;
  avatarUrl?: string;
}

interface CompanionTrip {
  _id: string;
  owner: CompanionOwner;
  title: string;
  destination: string;
  description: string;
  startDate: string;
  endDate: string;
  budget: number;
  coverImageUrl: string;
  members: CompanionMember[];
  maxMembers: number;
  status:
    | "planning"
    | "ongoing"
    | "completed"
    | "cancelled";
  visibility: "public" | "private";
  isLookingForCompanions: boolean;
  createdAt: string;
}

interface CompanionTripsResponse {
  success: boolean;
  trips: CompanionTrip[];
}

type JoinRequestStatus =
  | "none"
  | "pending"
  | "owner"
  | "member";

interface JoinRequestStatusResponse {
  success: boolean;
  requestStatus: JoinRequestStatus;
  invitationId: string | null;
}

function CompanionsPage() {
  const navigate = useNavigate();

  const [trips, setTrips] = useState<
    CompanionTrip[]
  >([]);

  const [searchText, setSearchText] =
    useState("");

  const [isLoading, setIsLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  const [requestStatuses, setRequestStatuses] =
    useState<Record<string, JoinRequestStatus>>(
      {}
    );

  const [processingTripId, setProcessingTripId] =
    useState<string | null>(null);

  useEffect(() => {
    const getCompanionTrips = async () => {
      try {
        setIsLoading(true);
        setMessage("");

        const response =
          await axiosClient.get<CompanionTripsResponse>(
            "/trips/companions"
          );
        const loadedTrips = response.data.trips;

        setTrips(loadedTrips);

        const statusResults = await Promise.all(
          loadedTrips.map(async (trip) => {
            try {
              const statusResponse =
                await axiosClient.get<JoinRequestStatusResponse>(
                  `/trip-invitations/trips/${trip._id}/join-request`
                );

              return [
                trip._id,
                statusResponse.data.requestStatus,
              ] as const;
            } catch {
              return [trip._id, "none"] as const;
            }
          })
        );

        setRequestStatuses(
          Object.fromEntries(statusResults)
        );
      } catch (error: any) {
        setMessage(
          error.response?.data?.message ||
            "Không thể lấy danh sách chuyến đi"
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

    getCompanionTrips();
  }, [navigate]);

  const filteredTrips = useMemo(() => {
    const keyword = searchText
      .trim()
      .toLocaleLowerCase("vi");

    if (!keyword) {
      return trips;
    }

    return trips.filter((trip) => {
      return (
        trip.title
          .toLocaleLowerCase("vi")
          .includes(keyword) ||
        trip.destination
          .toLocaleLowerCase("vi")
          .includes(keyword) ||
        trip.description
          .toLocaleLowerCase("vi")
          .includes(keyword)
      );
    });
  }, [searchText, trips]);

  const formatDate = (value: string) => {
    return new Date(value).toLocaleDateString(
      "vi-VN"
    );
  };

  const formatMoney = (value: number) => {
    return new Intl.NumberFormat("vi-VN").format(
      value
    );
  };

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

  const handleSendJoinRequest = async (
    tripId: string
  ) => {
    try {
      setProcessingTripId(tripId);
      setMessage("");

      await axiosClient.post(
        `/trip-invitations/trips/${tripId}/join-request`,
        {
          message:
            "Tôi muốn tham gia chuyến đi này",
        }
      );

      setRequestStatuses((currentStatuses) => ({
        ...currentStatuses,
        [tripId]: "pending",
      }));

      setMessage(
        "Đã gửi yêu cầu tham gia đến chủ chuyến đi"
      );
    } catch (error: any) {
      setMessage(
        error.response?.data?.message ||
          "Không thể gửi yêu cầu tham gia"
      );
    } finally {
      setProcessingTripId(null);
    }
  };

  const handleCancelJoinRequest = async (
    tripId: string
  ) => {
    try {
      setProcessingTripId(tripId);
      setMessage("");

      await axiosClient.delete(
        `/trip-invitations/trips/${tripId}/join-request`
      );

      setRequestStatuses((currentStatuses) => ({
        ...currentStatuses,
        [tripId]: "none",
      }));

      setMessage("Đã hủy yêu cầu tham gia");
    } catch (error: any) {
      setMessage(
        error.response?.data?.message ||
          "Không thể hủy yêu cầu tham gia"
      );
    } finally {
      setProcessingTripId(null);
    }
  };

  return (
    <div className="companions-page">
      <header className="companions-header">
        <Link
          className="companions-brand"
          to="/home"
        >
          Travel Community
        </Link>

        <button
          type="button"
          onClick={() => navigate("/home")}
        >
          Trang chủ
        </button>
      </header>

      <main className="companions-container">
        <section className="companions-hero">
          <div>
            <span className="companions-eyebrow">
              KẾT NỐI CỘNG ĐỒNG
            </span>

            <h1>Tìm bạn đồng hành</h1>

            <p>
              Khám phá các chuyến đi công khai và
              tìm những người có cùng sở thích du
              lịch với bạn.
            </p>
          </div>

          <div className="companions-hero-icon">
            🧭
          </div>
        </section>

        <section className="companions-toolbar">
          <div>
            <h2>Chuyến đi đang tuyển thành viên</h2>

            <p>
              Có {filteredTrips.length} chuyến đi phù
              hợp
            </p>
          </div>

          <input
            type="search"
            value={searchText}
            onChange={(event) =>
              setSearchText(event.target.value)
            }
            placeholder="Tìm theo địa điểm hoặc tên chuyến đi..."
          />
        </section>

        {message && (
          <div className="companions-message">
            {message}
          </div>
        )}

        {isLoading ? (
          <div className="companions-status">
            Đang tải danh sách chuyến đi...
          </div>
        ) : filteredTrips.length === 0 ? (
          <div className="companions-empty">
            <span>🗺️</span>
            <h2>Chưa có chuyến đi phù hợp</h2>
            <p>
              Hãy thử tìm bằng từ khóa khác hoặc tạo
              một chuyến đi công khai.
            </p>

            <Link to="/trips">
              Tạo chuyến đi
            </Link>
          </div>
        ) : (
          <section className="companions-list">
            {filteredTrips.map((trip) => (
              <article
                className="companion-trip-card"
                key={trip._id}
              >
                <div className="companion-trip-cover">
                  {trip.coverImageUrl ? (
                    <img
                      src={trip.coverImageUrl}
                      alt={trip.title}
                    />
                  ) : (
                    <span>🗺️</span>
                  )}

                  <span className="companion-trip-status">
                    Đang tìm bạn đồng hành
                  </span>
                </div>

                <div className="companion-trip-content">
                  <div className="companion-owner">
                    <div className="companion-owner-avatar">
                      {trip.owner.avatarUrl ? (
                        <img
                          src={trip.owner.avatarUrl}
                          alt={trip.owner.fullName}
                        />
                      ) : (
                        getFirstLetter(
                          trip.owner.fullName
                        )
                      )}
                    </div>

                    <div>
                      <strong>
                        {trip.owner.fullName}
                      </strong>
                      <span>Người tổ chức</span>
                    </div>
                  </div>

                  <div className="companion-trip-heading">
                    <div>
                      <span>
                        📍 {trip.destination}
                      </span>

                      <h2>{trip.title}</h2>
                    </div>

                    <span className="companion-capacity">
                      {Math.min(
                        trip.members.length + 1,
                        trip.maxMembers
                      )}
                      /{trip.maxMembers} người
                    </span>
                  </div>

                  {trip.description && (
                    <p className="companion-description">
                      {trip.description}
                    </p>
                  )}

                  <div className="companion-trip-information">
                    <span>
                      📅 {formatDate(trip.startDate)}
                      {" – "}
                      {formatDate(trip.endDate)}
                    </span>

                    <span>
                      💰 {formatMoney(trip.budget)} đ
                    </span>
                  </div>

                  <div className="companion-trip-actions">
                    <Link
                      className="companion-detail-link"
                      to={`/trips/${trip._id}`}
                    >
                      Xem chi tiết chuyến đi
                    </Link>

                    {requestStatuses[trip._id] ===
                      "none" && (
                      <button
                        className="send-join-request-button"
                        type="button"
                        disabled={
                          processingTripId === trip._id
                        }
                        onClick={() =>
                          handleSendJoinRequest(
                            trip._id
                          )
                        }
                      >
                        {processingTripId === trip._id
                          ? "Đang gửi..."
                          : "Yêu cầu tham gia"}
                      </button>
                    )}

                    {requestStatuses[trip._id] ===
                      "pending" && (
                      <button
                        className="cancel-join-request-button"
                        type="button"
                        disabled={
                          processingTripId === trip._id
                        }
                        onClick={() =>
                          handleCancelJoinRequest(
                            trip._id
                          )
                        }
                      >
                        {processingTripId === trip._id
                          ? "Đang hủy..."
                          : "Hủy yêu cầu"}
                      </button>
                    )}

                    {requestStatuses[trip._id] ===
                      "member" && (
                      <span className="join-request-label member">
                        ✓ Bạn đã tham gia
                      </span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

export default CompanionsPage;