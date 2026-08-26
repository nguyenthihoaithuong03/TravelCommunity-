import {
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";

import axiosClient from "../api/axiosClient";
import "../styles/trips.css";

type TripStatus =
  | "planning"
  | "ongoing"
  | "completed"
  | "cancelled";

interface TripUser {
  _id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
}

interface TripData {
  _id: string;
  owner: TripUser;
  title: string;
  destination: string;
  description: string;
  startDate: string;
  endDate: string;
  budget: number;
  coverImageUrl: string;
  members: TripUser[];
  status: TripStatus;
  visibility: "private" | "public";
  isLookingForCompanions: boolean;
  maxMembers: number;
  createdAt: string;
  updatedAt: string;
}

interface TripsResponse {
  success: boolean;
  trips: TripData[];
}

interface CreateTripResponse {
  success: boolean;
  message: string;
  trip: TripData;
}

interface TripFormData {
  title: string;
  destination: string;
  description: string;
  startDate: string;
  endDate: string;
  budget: string;
  visibility: "private" | "public";
  isLookingForCompanions: boolean;
  maxMembers: string;
}

const emptyForm: TripFormData = {
  title: "",
  destination: "",
  description: "",
  startDate: "",
  endDate: "",
  budget: "",
  visibility: "private",
  isLookingForCompanions: false,
  maxMembers: "4",
};

const statusLabels: Record<TripStatus, string> = {
  planning: "Đang lên kế hoạch",
  ongoing: "Đang diễn ra",
  completed: "Đã hoàn thành",
  cancelled: "Đã hủy",
};

const getCurrentUserId = (): string => {
  try {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      return "";
    }

    const user = JSON.parse(storedUser) as {
      _id?: string;
    };

    return user._id || "";
  } catch {
    return "";
  }
};

function TripsPage() {
  const navigate = useNavigate();
  const currentUserId = getCurrentUserId();

  const [trips, setTrips] =
    useState<TripData[]>([]);
  const [formData, setFormData] =
    useState<TripFormData>(emptyForm);
  const [isLoading, setIsLoading] =
    useState(true);
  const [isCreating, setIsCreating] =
    useState(false);
  const [isCreateOpen, setIsCreateOpen] =
    useState(false);
  const [deletingTripId, setDeletingTripId] =
    useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] =
    useState("");

  const getMyTrips = useCallback(async () => {
    try {
      setIsLoading(true);

      const response =
        await axiosClient.get<TripsResponse>(
          "/trips/my"
        );

      const newestTripsFirst = [
        ...response.data.trips,
      ].sort((firstTrip, secondTrip) => {
        return (
          new Date(secondTrip.createdAt).getTime() -
          new Date(firstTrip.createdAt).getTime()
        );
      });

      setTrips(newestTripsFirst);
      setErrorMessage("");
    } catch (error: any) {
      setErrorMessage(
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
  }, [navigate]);

  useEffect(() => {
    void getMyTrips();
  }, [getMyTrips]);

  useEffect(() => {
    if (!isCreateOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsCreateOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape
      );
      document.body.style.overflow = "";
    };
  }, [isCreateOpen]);

  const handleInputChange = (
    field: keyof TripFormData,
    value: string
  ) => {
    setFormData((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const closeCreateModal = () => {
    if (isCreating) {
      return;
    }

    setIsCreateOpen(false);
    setErrorMessage("");
  };

  const handleCreateTrip = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!formData.title.trim()) {
      setErrorMessage(
        "Tên chuyến đi không được để trống"
      );
      return;
    }

    if (!formData.destination.trim()) {
      setErrorMessage(
        "Điểm đến không được để trống"
      );
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      setErrorMessage(
        "Bạn cần chọn ngày bắt đầu và ngày kết thúc"
      );
      return;
    }

    if (formData.endDate < formData.startDate) {
      setErrorMessage(
        "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu"
      );
      return;
    }

    const parsedMaxMembers = Number(
      formData.maxMembers
    );

    if (
      !Number.isInteger(parsedMaxMembers) ||
      parsedMaxMembers < 2 ||
      parsedMaxMembers > 100
    ) {
      setErrorMessage(
        "Số người tối đa phải từ 2 đến 100"
      );
      return;
    }

    if (
      formData.isLookingForCompanions &&
      formData.visibility !== "public"
    ) {
      setErrorMessage(
        "Chuyến đi phải công khai khi tìm bạn đồng hành"
      );
      return;
    }

    try {
      setIsCreating(true);
      setErrorMessage("");

      const response =
        await axiosClient.post<CreateTripResponse>(
          "/trips",
          {
            title: formData.title.trim(),
            destination:
              formData.destination.trim(),
            description:
              formData.description.trim(),
            startDate: formData.startDate,
            endDate: formData.endDate,
            budget: formData.budget
              ? Number(formData.budget)
              : 0,
            visibility: formData.visibility,
            isLookingForCompanions:
              formData.isLookingForCompanions,
            maxMembers: parsedMaxMembers,
          }
        );

      setTrips((currentTrips) => [
        response.data.trip,
        ...currentTrips,
      ]);

      setFormData(emptyForm);
      setIsCreateOpen(false);
      setMessage("Tạo chuyến đi thành công");

      window.setTimeout(() => {
        setMessage("");
      }, 2500);
    } catch (error: any) {
      setErrorMessage(
        error.response?.data?.message ||
          "Không thể tạo chuyến đi"
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteTrip = async (
    tripId: string
  ) => {
    const isConfirmed = window.confirm(
      "Bạn có chắc chắn muốn xóa chuyến đi này không?"
    );

    if (!isConfirmed) {
      return;
    }

    try {
      setDeletingTripId(tripId);

      await axiosClient.delete(
        `/trips/${tripId}`
      );

      setTrips((currentTrips) =>
        currentTrips.filter(
          (trip) => trip._id !== tripId
        )
      );

      setMessage("Xóa chuyến đi thành công");

      window.setTimeout(() => {
        setMessage("");
      }, 2500);
    } catch (error: any) {
      setErrorMessage(
        error.response?.data?.message ||
          "Không thể xóa chuyến đi"
      );
    } finally {
      setDeletingTripId(null);
    }
  };

  const formatDate = (value: string) => {
    return new Date(value).toLocaleDateString(
      "vi-VN"
    );
  };

  const formatBudget = (value: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="trips-page">
     <header className="trips-header">
  <Link
    className="trips-brand"
    to="/home"
  >
    Travel Community
  </Link>

  <div className="trips-header-actions">
    <button
      className="back-home-button"
      type="button"
      onClick={() => navigate("/home")}
    >
      Trang chủ
    </button>

    <button
      className="create-trip-header-button"
      type="button"
      onClick={() =>
        setIsCreateOpen(true)
      }
    >
      + Tạo chuyến đi
    </button>
  </div>
</header>

      <main className="trips-container">
        <section className="trips-introduction">
          <div>
            <span>HÀNH TRÌNH CỦA BẠN</span>
            <h1>Chuyến đi của tôi</h1>
            <p>
              Lập kế hoạch, quản lý thành viên và lưu
              lại những hành trình đáng nhớ.
            </p>
          </div>
        </section>

        {message && (
          <div className="trips-alert success">
            {message}
          </div>
        )}

        {errorMessage && !isCreateOpen && (
          <div className="trips-alert error">
            {errorMessage}
          </div>
        )}

        {isLoading ? (
          <div className="trips-status">
            Đang tải chuyến đi...
          </div>
        ) : trips.length === 0 ? (
          <section className="trips-empty">
            <div>🧳</div>
            <h2>Bạn chưa có chuyến đi nào</h2>
            <p>
              Hãy tạo chuyến đi đầu tiên và bắt đầu
              lên kế hoạch cho hành trình của mình.
            </p>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
            >
              Tạo chuyến đi
            </button>
          </section>
        ) : (
          <section
            className="trips-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr)",
            }}
          >
            {trips.map((trip) => (
              <article className="trip-card" key={trip._id}>
                <div className="trip-cover">
                  {trip.coverImageUrl ? (
                    <img
                      src={trip.coverImageUrl}
                      alt={trip.title}
                    />
                  ) : (
                    <div className="trip-cover-placeholder">
                      🗺️
                    </div>
                  )}

                  <span
                    className={`trip-status ${trip.status}`}
                  >
                    {statusLabels[trip.status]}
                  </span>
                </div>

                <div className="trip-card-content">
                  <p className="trip-destination">
                    📍 {trip.destination}
                  </p>

                  <h2>{trip.title}</h2>

                  <p className="trip-description">
                    {trip.description ||
                      "Chưa có mô tả cho chuyến đi."}
                  </p>

                  <div className="trip-information">
                    <span>
                      📅 {formatDate(trip.startDate)} –{" "}
                      {formatDate(trip.endDate)}
                    </span>
                    <span>
                      💰 {formatBudget(trip.budget)}
                    </span>
                    <span>
                      👥 {trip.members.length + 1}/
                      {trip.maxMembers} người
                    </span>
                  </div>

                  <div className="trip-visibility-info">
                    <span>
                      {trip.visibility === "public"
                        ? "🌐 Công khai"
                        : "🔒 Riêng tư"}
                    </span>

                    {trip.isLookingForCompanions && (
                      <span className="looking-companion-badge">
                        🤝 Đang tìm bạn đồng hành
                      </span>
                    )}
                  </div>

                  <div className="trip-card-actions">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/trips/${trip._id}`)
                      }
                    >
                      Xem chi tiết
                    </button>

                    {trip.owner._id === currentUserId && (
                      <button
                        className="trip-delete-button"
                        type="button"
                        disabled={
                          deletingTripId === trip._id
                        }
                        onClick={() =>
                          handleDeleteTrip(trip._id)
                        }
                      >
                        {deletingTripId === trip._id
                          ? "Đang xóa..."
                          : "Xóa"}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>

      {isCreateOpen && (
        <div
          className="trip-modal-overlay"
          onMouseDown={closeCreateModal}
        >
          <section
            className="trip-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <header>
              <div>
                <h2>Tạo chuyến đi mới</h2>
                <p>
                  Nhập thông tin cơ bản cho hành trình.
                </p>
              </div>

              <button
                type="button"
                aria-label="Đóng"
                onClick={closeCreateModal}
              >
                ×
              </button>
            </header>

            <form onSubmit={handleCreateTrip}>
              {errorMessage && (
                <div className="trips-alert error">
                  {errorMessage}
                </div>
              )}

              <label>
                Tên chuyến đi <strong>*</strong>
                <input
                  type="text"
                  maxLength={150}
                  placeholder="Ví dụ: Đà Lạt 3 ngày 2 đêm"
                  value={formData.title}
                  onChange={(event) =>
                    handleInputChange(
                      "title",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Điểm đến <strong>*</strong>
                <input
                  type="text"
                  maxLength={200}
                  placeholder="Ví dụ: Đà Lạt, Lâm Đồng"
                  value={formData.destination}
                  onChange={(event) =>
                    handleInputChange(
                      "destination",
                      event.target.value
                    )
                  }
                />
              </label>

              <div className="trip-form-row">
                <label>
                  Ngày bắt đầu <strong>*</strong>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(event) =>
                      handleInputChange(
                        "startDate",
                        event.target.value
                      )
                    }
                  />
                </label>

                <label>
                  Ngày kết thúc <strong>*</strong>
                  <input
                    type="date"
                    min={formData.startDate || undefined}
                    value={formData.endDate}
                    onChange={(event) =>
                      handleInputChange(
                        "endDate",
                        event.target.value
                      )
                    }
                  />
                </label>
              </div>

              <label>
                Ngân sách dự kiến
                <input
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="Ví dụ: 3000000"
                  value={formData.budget}
                  onChange={(event) =>
                    handleInputChange(
                      "budget",
                      event.target.value
                    )
                  }
                />
              </label>

              <div className="trip-form-row">
                <label>
                  Quyền hiển thị

                  <select
                    value={formData.visibility}
                    onChange={(event) => {
                      const visibility =
                        event.target.value as
                          | "private"
                          | "public";

                      setFormData((currentForm) => ({
                        ...currentForm,
                        visibility,
                        isLookingForCompanions:
                          visibility === "private"
                            ? false
                            : currentForm.isLookingForCompanions,
                      }));
                    }}
                  >
                    <option value="private">
                      🔒 Riêng tư
                    </option>
                    <option value="public">
                      🌐 Công khai
                    </option>
                  </select>
                </label>

                <label>
                  Số người tối đa

                  <input
                    type="number"
                    min="2"
                    max="100"
                    value={formData.maxMembers}
                    onChange={(event) =>
                      handleInputChange(
                        "maxMembers",
                        event.target.value
                      )
                    }
                  />
                </label>
              </div>

              <label className="looking-companion-option">
                <input
                  type="checkbox"
                  checked={
                    formData.isLookingForCompanions
                  }
                  onChange={(event) => {
                    const isLookingForCompanions =
                      event.target.checked;

                    setFormData((currentForm) => ({
                      ...currentForm,
                      isLookingForCompanions,
                      visibility:
                        isLookingForCompanions
                          ? "public"
                          : currentForm.visibility,
                    }));
                  }}
                />

                <span>
                  <strong>
                    Tìm bạn đồng hành
                  </strong>
                  <small>
                    Chuyến đi sẽ được công khai để
                    người khác có thể xem và gửi yêu
                    cầu tham gia.
                  </small>
                </span>
              </label>

              <label>
                Mô tả
                <textarea
                  rows={4}
                  maxLength={1000}
                  placeholder="Mô tả ngắn về chuyến đi..."
                  value={formData.description}
                  onChange={(event) =>
                    handleInputChange(
                      "description",
                      event.target.value
                    )
                  }
                />
              </label>

              <div className="trip-form-actions">
                <button
                  type="button"
                  disabled={isCreating}
                  onClick={closeCreateModal}
                >
                  Hủy
                </button>

                <button
                  className="trip-submit-button"
                  type="submit"
                  disabled={isCreating}
                >
                  {isCreating
                    ? "Đang tạo..."
                    : "Tạo chuyến đi"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default TripsPage;