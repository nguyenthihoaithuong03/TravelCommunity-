import {
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import axiosClient from "../api/axiosClient";
import "../styles/tripDetail.css";
import InviteTripMemberModal from "../components/InviteTripMemberModal";

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

interface TripResponse {
  success: boolean;
  message?: string;
  trip: TripData;
}

interface EditTripForm {
  title: string;
  destination: string;
  description: string;
  startDate: string;
  endDate: string;
  budget: string;
  status: TripStatus;
  visibility: "private" | "public";
  isLookingForCompanions: boolean;
  maxMembers: string;
}

interface TripActivityData {
  _id: string;
  trip: string;
  creator: TripUser;
  activityDate: string;
  startTime: string;
  endTime: string;
  title: string;
  location: string;
  description: string;
  estimatedCost: number;
  order: number;
  createdAt: string;
  updatedAt: string;
}

interface ActivitiesResponse {
  success: boolean;
  activities: TripActivityData[];
}

interface ActivityResponse {
  success: boolean;
  message: string;
  activity: TripActivityData;
}

interface ActivityFormData {
  activityDate: string;
  startTime: string;
  endTime: string;
  title: string;
  location: string;
  description: string;
  estimatedCost: string;
}

type JoinRequestStatus =
  | "none"
  | "pending"
  | "member"
  | "owner";

interface JoinRequestStatusResponse {
  success: boolean;
  requestStatus: JoinRequestStatus;
  invitationId: string | null;
}

interface JoinRequestResponse {
  success: boolean;
  message: string;
  requestStatus: JoinRequestStatus;
}

const emptyActivityForm: ActivityFormData = {
  activityDate: "",
  startTime: "08:00",
  endTime: "",
  title: "",
  location: "",
  description: "",
  estimatedCost: "",
};

const statusLabels: Record<TripStatus, string> = {
  planning: "Đang lên kế hoạch",
  ongoing: "Đang diễn ra",
  completed: "Đã hoàn thành",
  cancelled: "Đã hủy",
};

const toDateInputValue = (value: string) => {
  return new Date(value).toISOString().slice(0, 10);
};

const getCurrentUserId = () => {
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

function TripDetailPage() {
  const { tripId } = useParams<{
    tripId: string;
  }>();
  const navigate = useNavigate();
  const currentUserId = getCurrentUserId();

  const [trip, setTrip] =
    useState<TripData | null>(null);
  const [editForm, setEditForm] =
    useState<EditTripForm | null>(null);
  const [isLoading, setIsLoading] =
    useState(true);
  const [isEditing, setIsEditing] =
    useState(false);
  const [isSaving, setIsSaving] =
    useState(false);
  const [isDeleting, setIsDeleting] =
    useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] =
    useState("");
  const [activities, setActivities] =
    useState<TripActivityData[]>([]);
  const [activityForm, setActivityForm] =
    useState<ActivityFormData>(emptyActivityForm);
  const [isLoadingActivities, setIsLoadingActivities] =
    useState(true);
  const [isActivityFormOpen, setIsActivityFormOpen] =
    useState(false);
  const [editingActivityId, setEditingActivityId] =
    useState<string | null>(null);
  const [isSavingActivity, setIsSavingActivity] =
    useState(false);
  const [deletingActivityId, setDeletingActivityId] =
    useState<string | null>(null);
  const [
    isInviteMemberOpen,
    setIsInviteMemberOpen,
  ] = useState(false);
  const [
    joinRequestStatus,
    setJoinRequestStatus,
  ] = useState<JoinRequestStatus>("none");
  const [
    isLoadingJoinRequest,
    setIsLoadingJoinRequest,
  ] = useState(true);
  const [
    isProcessingJoinRequest,
    setIsProcessingJoinRequest,
  ] = useState(false);

  const getTrip = useCallback(async () => {
    if (!tripId) {
      setErrorMessage("Mã chuyến đi không hợp lệ");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      const response =
        await axiosClient.get<TripResponse>(
          `/trips/${tripId}`
        );

      setTrip(response.data.trip);
      setErrorMessage("");
    } catch (error: any) {
      setErrorMessage(
        error.response?.data?.message ||
          "Không thể lấy thông tin chuyến đi"
      );

      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
      }
    } finally {
      setIsLoading(false);
    }
  }, [navigate, tripId]);

  useEffect(() => {
    void getTrip();
  }, [getTrip]);

  const getActivities = useCallback(async () => {
    if (!tripId) {
      setIsLoadingActivities(false);
      return;
    }

    try {
      setIsLoadingActivities(true);

      const response =
        await axiosClient.get<ActivitiesResponse>(
          `/trips/${tripId}/activities`
        );

      setActivities(response.data.activities);
    } catch (error: any) {
      setErrorMessage(
        error.response?.data?.message ||
          "Không thể lấy lịch trình"
      );
    } finally {
      setIsLoadingActivities(false);
    }
  }, [tripId]);

  useEffect(() => {
    void getActivities();
  }, [getActivities]);

  const getJoinRequestStatus =
    useCallback(async () => {
      if (!tripId || !currentUserId) {
        setIsLoadingJoinRequest(false);
        return;
      }

      try {
        setIsLoadingJoinRequest(true);

        const response =
          await axiosClient.get<JoinRequestStatusResponse>(
            `/trip-invitations/trips/${tripId}/join-request`
          );

        setJoinRequestStatus(
          response.data.requestStatus
        );
      } catch (error: any) {
        if (error.response?.status !== 404) {
          setErrorMessage(
            error.response?.data?.message ||
              "Không thể kiểm tra yêu cầu tham gia"
          );
        }
      } finally {
        setIsLoadingJoinRequest(false);
      }
    }, [currentUserId, tripId]);

  useEffect(() => {
    void getJoinRequestStatus();
  }, [getJoinRequestStatus]);

  const handleSendJoinRequest = async () => {
    if (!trip) {
      return;
    }

    try {
      setIsProcessingJoinRequest(true);
      setErrorMessage("");

      const response =
        await axiosClient.post<JoinRequestResponse>(
          `/trip-invitations/trips/${trip._id}/join-request`,
          {}
        );

      setJoinRequestStatus("pending");
      setMessage(response.data.message);

      window.setTimeout(() => {
        setMessage("");
      }, 2500);
    } catch (error: any) {
      setErrorMessage(
        error.response?.data?.message ||
          "Không thể gửi yêu cầu tham gia"
      );
    } finally {
      setIsProcessingJoinRequest(false);
    }
  };

  const handleCancelJoinRequest = async () => {
    if (!trip) {
      return;
    }

    const isConfirmed = window.confirm(
      "Bạn có chắc muốn hủy yêu cầu tham gia không?"
    );

    if (!isConfirmed) {
      return;
    }

    try {
      setIsProcessingJoinRequest(true);
      setErrorMessage("");

      const response =
        await axiosClient.delete<JoinRequestResponse>(
          `/trip-invitations/trips/${trip._id}/join-request`
        );

      setJoinRequestStatus("none");
      setMessage(response.data.message);

      window.setTimeout(() => {
        setMessage("");
      }, 2500);
    } catch (error: any) {
      setErrorMessage(
        error.response?.data?.message ||
          "Không thể hủy yêu cầu tham gia"
      );
    } finally {
      setIsProcessingJoinRequest(false);
    }
  };

  const beginEditing = () => {
    if (!trip) {
      return;
    }

    setEditForm({
      title: trip.title,
      destination: trip.destination,
      description: trip.description,
      startDate: toDateInputValue(trip.startDate),
      endDate: toDateInputValue(trip.endDate),
      budget: String(trip.budget),
      status: trip.status,
      visibility: trip.visibility,
      isLookingForCompanions:
        trip.isLookingForCompanions,
      maxMembers: String(trip.maxMembers),
    });

    setErrorMessage("");
    setIsEditing(true);
  };

  const updateFormField = <
    Field extends keyof EditTripForm,
  >(
    field: Field,
    value: EditTripForm[Field]
  ) => {
    setEditForm((currentForm) =>
      currentForm
        ? {
            ...currentForm,
            [field]: value,
          }
        : currentForm
    );
  };

  const handleSaveTrip = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!trip || !editForm) {
      return;
    }

    if (
      !editForm.title.trim() ||
      !editForm.destination.trim()
    ) {
      setErrorMessage(
        "Tên chuyến đi và điểm đến không được để trống"
      );
      return;
    }

    if (editForm.endDate < editForm.startDate) {
      setErrorMessage(
        "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu"
      );
      return;
    }

    const parsedMaxMembers = Number(
      editForm.maxMembers
    );

    if (
      !Number.isInteger(parsedMaxMembers) ||
      parsedMaxMembers < 2 ||
      parsedMaxMembers > 100
    ) {
      setErrorMessage(
        "Số người tối đa phải là số nguyên từ 2 đến 100"
      );
      return;
    }

    if (
      parsedMaxMembers <
      trip.members.length + 1
    ) {
      setErrorMessage(
        "Số người tối đa không được nhỏ hơn số thành viên hiện tại"
      );
      return;
    }

    if (
      editForm.isLookingForCompanions &&
      editForm.visibility !== "public"
    ) {
      setErrorMessage(
        "Chuyến đi phải được công khai khi tìm bạn đồng hành"
      );
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage("");

      const response =
        await axiosClient.put<TripResponse>(
          `/trips/${trip._id}`,
          {
            title: editForm.title.trim(),
            destination:
              editForm.destination.trim(),
            description:
              editForm.description.trim(),
            startDate: editForm.startDate,
            endDate: editForm.endDate,
            budget: editForm.budget
              ? Number(editForm.budget)
              : 0,
            status: editForm.status,
            visibility: editForm.visibility,
            isLookingForCompanions:
              editForm.isLookingForCompanions,
            maxMembers: parsedMaxMembers,
          }
        );

      setTrip(response.data.trip);
      setIsEditing(false);
      setMessage("Cập nhật chuyến đi thành công");

      window.setTimeout(() => {
        setMessage("");
      }, 2500);
    } catch (error: any) {
      setErrorMessage(
        error.response?.data?.message ||
          "Không thể cập nhật chuyến đi"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTrip = async () => {
    if (!trip) {
      return;
    }

    const isConfirmed = window.confirm(
      "Bạn có chắc chắn muốn xóa chuyến đi này không?"
    );

    if (!isConfirmed) {
      return;
    }

    try {
      setIsDeleting(true);

      await axiosClient.delete(
        `/trips/${trip._id}`
      );

      navigate("/trips", {
        replace: true,
      });
    } catch (error: any) {
      setErrorMessage(
        error.response?.data?.message ||
          "Không thể xóa chuyến đi"
      );
      setIsDeleting(false);
    }
  };

  const openCreateActivityForm = () => {
    if (!trip) return;

    setEditingActivityId(null);
    setActivityForm({
      ...emptyActivityForm,
      activityDate: toDateInputValue(trip.startDate),
    });
    setErrorMessage("");
    setIsActivityFormOpen(true);
  };

  const openEditActivityForm = (
    activity: TripActivityData
  ) => {
    setEditingActivityId(activity._id);
    setActivityForm({
      activityDate: toDateInputValue(
        activity.activityDate
      ),
      startTime: activity.startTime,
      endTime: activity.endTime,
      title: activity.title,
      location: activity.location,
      description: activity.description,
      estimatedCost:
        activity.estimatedCost > 0
          ? String(activity.estimatedCost)
          : "",
    });
    setErrorMessage("");
    setIsActivityFormOpen(true);
  };

  const closeActivityForm = () => {
    setIsActivityFormOpen(false);
    setEditingActivityId(null);
    setActivityForm(emptyActivityForm);
  };

  const updateActivityFormField = (
    field: keyof ActivityFormData,
    value: string
  ) => {
    setActivityForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const handleSaveActivity = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!trip) return;

    if (
      !activityForm.title.trim() ||
      !activityForm.activityDate ||
      !activityForm.startTime
    ) {
      setErrorMessage(
        "Hãy nhập tên, ngày và giờ bắt đầu của hoạt động"
      );
      return;
    }

    if (
      activityForm.endTime &&
      activityForm.endTime < activityForm.startTime
    ) {
      setErrorMessage(
        "Giờ kết thúc không được trước giờ bắt đầu"
      );
      return;
    }

    const payload = {
      activityDate: activityForm.activityDate,
      startTime: activityForm.startTime,
      endTime: activityForm.endTime,
      title: activityForm.title.trim(),
      location: activityForm.location.trim(),
      description: activityForm.description.trim(),
      estimatedCost: activityForm.estimatedCost
        ? Number(activityForm.estimatedCost)
        : 0,
    };

    try {
      setIsSavingActivity(true);
      setErrorMessage("");

      const response = editingActivityId
        ? await axiosClient.put<ActivityResponse>(
            `/trips/activities/${editingActivityId}`,
            payload
          )
        : await axiosClient.post<ActivityResponse>(
            `/trips/${trip._id}/activities`,
            payload
          );

      setActivities((currentActivities) => {
        const nextActivities = editingActivityId
          ? currentActivities.map((activity) =>
              activity._id === editingActivityId
                ? response.data.activity
                : activity
            )
          : [...currentActivities, response.data.activity];

        return nextActivities.sort((first, second) => {
          const firstTime = `${first.activityDate}-${first.startTime}`;
          const secondTime = `${second.activityDate}-${second.startTime}`;
          return firstTime.localeCompare(secondTime);
        });
      });

      setMessage(
        editingActivityId
          ? "Cập nhật hoạt động thành công"
          : "Thêm hoạt động thành công"
      );
      closeActivityForm();
      window.setTimeout(() => setMessage(""), 2500);
    } catch (error: any) {
      setErrorMessage(
        error.response?.data?.message ||
          "Không thể lưu hoạt động"
      );
    } finally {
      setIsSavingActivity(false);
    }
  };

  const handleDeleteActivity = async (
    activityId: string
  ) => {
    if (!window.confirm("Bạn muốn xóa hoạt động này?")) {
      return;
    }

    try {
      setDeletingActivityId(activityId);
      await axiosClient.delete(
        `/trips/activities/${activityId}`
      );
      setActivities((currentActivities) =>
        currentActivities.filter(
          (activity) => activity._id !== activityId
        )
      );
      setMessage("Xóa hoạt động thành công");
      window.setTimeout(() => setMessage(""), 2500);
    } catch (error: any) {
      setErrorMessage(
        error.response?.data?.message ||
          "Không thể xóa hoạt động"
      );
    } finally {
      setDeletingActivityId(null);
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

  const getFirstLetter = (name: string) => {
    return name.trim().charAt(0).toUpperCase() || "U";
  };

  if (isLoading) {
    return (
      <div className="trip-detail-page">
        <div className="trip-detail-status">
          Đang tải chuyến đi...
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="trip-detail-page">
        <div className="trip-detail-status error">
          <h2>Không thể mở chuyến đi</h2>
          <p>{errorMessage}</p>
          <Link to="/trips">
            ← Quay lại danh sách
          </Link>
          
        </div>
        
      </div>
    );
  }

  const isOwner = trip.owner._id === currentUserId;

  const totalActivityCost = activities.reduce(
    (total, activity) =>
      total + (activity.estimatedCost || 0),
    0
  );

  const remainingBudget =
    trip.budget - totalActivityCost;

  const budgetProgress =
    trip.budget > 0
      ? Math.min(
          (totalActivityCost / trip.budget) * 100,
          100
        )
      : 0;

  const groupedActivities = activities.reduce<
    Record<string, TripActivityData[]>
  >((groups, activity) => {
    const dateKey = toDateInputValue(
      activity.activityDate
    );
    groups[dateKey] = groups[dateKey] || [];
    groups[dateKey].push(activity);
    return groups;
  }, {});

  return (
    <div className="trip-detail-page">
      <header className="trip-detail-header">
        <Link to="/home">Travel Community</Link>

       <button
  type="button"
  onClick={() => navigate("/home")}
>
  Trang chủ
</button>
      </header>

      <main className="trip-detail-container">
        {message && (
          <div className="trip-detail-alert success">
            {message}
          </div>
        )}

        {errorMessage && (
          <div className="trip-detail-alert error">
            {errorMessage}
          </div>
        )}

        <section className="trip-detail-hero">
          {trip.coverImageUrl ? (
            <img
              src={trip.coverImageUrl}
              alt={trip.title}
            />
          ) : (
            <div className="trip-detail-cover-placeholder">
              🗺️
            </div>
          )}

          <div className="trip-detail-hero-overlay" />

          <div className="trip-detail-hero-content">
            <span className={`detail-status ${trip.status}`}>
              {statusLabels[trip.status]}
            </span>
            <p>📍 {trip.destination}</p>
            <h1>{trip.title}</h1>
            <div>
              📅 {formatDate(trip.startDate)} –{" "}
              {formatDate(trip.endDate)}
            </div>
          </div>
        </section>

        <div className="trip-detail-layout">
          <section className="trip-detail-main">
            <article className="trip-detail-card">
              <div className="trip-detail-card-heading">
                <h2>Thông tin chuyến đi</h2>

                {isOwner && !isEditing && (
                  <button
                    type="button"
                    onClick={beginEditing}
                  >
                    ✏️ Chỉnh sửa
                  </button>
                )}
              </div>

              {isEditing && editForm ? (
                <form
                  className="trip-edit-form"
                  onSubmit={handleSaveTrip}
                >
                  <label>
                    Tên chuyến đi
                    <input
                      value={editForm.title}
                      onChange={(event) =>
                        updateFormField(
                          "title",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <label>
                    Điểm đến
                    <input
                      value={editForm.destination}
                      onChange={(event) =>
                        updateFormField(
                          "destination",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <div className="trip-edit-row">
                    <label>
                      Ngày bắt đầu
                      <input
                        type="date"
                        value={editForm.startDate}
                        onChange={(event) =>
                          updateFormField(
                            "startDate",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      Ngày kết thúc
                      <input
                        type="date"
                        min={editForm.startDate}
                        value={editForm.endDate}
                        onChange={(event) =>
                          updateFormField(
                            "endDate",
                            event.target.value
                          )
                        }
                      />
                    </label>
                  </div>

                  <div className="trip-edit-row">
                    <label>
                      Ngân sách
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={editForm.budget}
                        onChange={(event) =>
                          updateFormField(
                            "budget",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      Trạng thái
                      <select
                        value={editForm.status}
                        onChange={(event) =>
                          updateFormField(
                            "status",
                            event.target.value as TripStatus
                          )
                        }
                      >
                        {Object.entries(statusLabels).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          )
                        )}
                      </select>
                    </label>
                  </div>

                  <div className="trip-edit-row">
                    <label>
                      Quyền hiển thị
                      <select
                        value={editForm.visibility}
                        onChange={(event) => {
                          const nextVisibility =
                            event.target.value as
                              | "private"
                              | "public";

                          setEditForm(
                            (currentForm) =>
                              currentForm
                                ? {
                                    ...currentForm,
                                    visibility:
                                      nextVisibility,
                                    isLookingForCompanions:
                                      nextVisibility ===
                                      "private"
                                        ? false
                                        : currentForm.isLookingForCompanions,
                                  }
                                : currentForm
                          );
                        }}
                      >
                        <option value="private">
                          🔒 Riêng tư
                        </option>
                        <option value="public">
                          🌍 Công khai
                        </option>
                      </select>
                    </label>

                    <label>
                      Số người tối đa
                      <input
                        type="number"
                        min="2"
                        max="100"
                        value={editForm.maxMembers}
                        onChange={(event) =>
                          updateFormField(
                            "maxMembers",
                            event.target.value
                          )
                        }
                      />
                    </label>
                  </div>

                  <label className="trip-looking-toggle">
                    <input
                      type="checkbox"
                      checked={
                        editForm.isLookingForCompanions
                      }
                      disabled={
                        editForm.visibility !== "public"
                      }
                      onChange={(event) =>
                        updateFormField(
                          "isLookingForCompanions",
                          event.target.checked
                        )
                      }
                    />

                    <span>
                      Đang tìm thêm bạn đồng hành
                    </span>
                  </label>

                  {editForm.visibility ===
                    "private" && (
                    <small className="trip-edit-help">
                      Chọn Công khai để bật chức năng tìm
                      bạn đồng hành.
                    </small>
                  )}

                  <label>
                    Mô tả
                    <textarea
                      rows={5}
                      maxLength={1000}
                      value={editForm.description}
                      onChange={(event) =>
                        updateFormField(
                          "description",
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <div className="trip-edit-actions">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => {
                        setIsEditing(false);
                        setErrorMessage("");
                      }}
                    >
                      Hủy
                    </button>

                    <button
                      className="save-trip-button"
                      type="submit"
                      disabled={isSaving}
                    >
                      {isSaving
                        ? "Đang lưu..."
                        : "Lưu thay đổi"}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="trip-detail-description">
                    {trip.description ||
                      "Chuyến đi này chưa có mô tả."}
                  </p>
                  <div className="trip-detail-facts">
                    <div>
                      <span>Ngày bắt đầu</span>
                      <strong>
                        {formatDate(trip.startDate)}
                      </strong>
                    </div>
                    <div>
                      <span>Ngày kết thúc</span>
                      <strong>
                        {formatDate(trip.endDate)}
                      </strong>
                    </div>
                    <div>
                      <span>Ngân sách dự kiến</span>
                      <strong>
                        {formatBudget(trip.budget)}
                      </strong>
                    </div>
                    <div>
                      <span>Số thành viên</span>
                      <strong>
                        {trip.members.length + 1}/
                        {trip.maxMembers} người
                      </strong>
                    </div>
                    <div>
                      <span>Quyền hiển thị</span>
                      <strong>
                        {trip.visibility === "public"
                          ? "🌍 Công khai"
                          : "🔒 Riêng tư"}
                      </strong>
                    </div>
                    <div>
                      <span>Tìm bạn đồng hành</span>
                      <strong>
                        {trip.isLookingForCompanions
                          ? "Đang tìm thành viên"
                          : "Đã tắt"}
                      </strong>
                    </div>
                  </div>
                </>
              )}
            </article>

            <article className="trip-detail-card trip-budget-card">
              <div className="trip-detail-card-heading">
                <div>
                  <h2>Chi phí chuyến đi</h2>
                  <p>
                    Tổng hợp từ các hoạt động trong lịch
                    trình.
                  </p>
                </div>
              </div>

              <div className="trip-budget-summary">
                <div>
                  <span>Ngân sách</span>
                  <strong>
                    {formatBudget(trip.budget)}
                  </strong>
                </div>

                <div>
                  <span>Đã dự kiến chi</span>
                  <strong>
                    {formatBudget(totalActivityCost)}
                  </strong>
                </div>

                <div>
                  <span>Còn lại</span>
                  <strong
                    className={
                      remainingBudget < 0
                        ? "budget-over"
                        : "budget-remaining"
                    }
                  >
                    {formatBudget(remainingBudget)}
                  </strong>
                </div>
              </div>

              {trip.budget > 0 && (
                <>
                  <div className="budget-progress">
                    <div
                      style={{
                        width: `${budgetProgress}%`,
                      }}
                    />
                  </div>

                  <p className="budget-progress-text">
                    Đã sử dụng{" "}
                    {Math.round(
                      (totalActivityCost /
                        trip.budget) *
                        100
                    )}
                    % ngân sách
                  </p>
                </>
              )}

              {remainingBudget < 0 && (
                <div className="budget-warning">
                  ⚠️ Lịch trình đang vượt ngân sách{" "}
                  {formatBudget(
                    Math.abs(remainingBudget)
                  )}
                </div>
              )}
            </article>

            <article className="trip-detail-card">
              <div className="trip-detail-card-heading">
                <div>
                  <h2>Lịch trình</h2>
                  <p>
                    Các hoạt động theo từng ngày sẽ hiển
                    thị tại đây.
                  </p>
                </div>
                {isOwner && (
            <button
               type="button"
             onClick={openCreateActivityForm}
             >
              + Thêm hoạt động
             </button>
                 )}
              </div>

              {isActivityFormOpen && (
                <form
                  className="trip-edit-form activity-form"
                  onSubmit={handleSaveActivity}
                >
                  <h3>
                    {editingActivityId
                      ? "Sửa hoạt động"
                      : "Thêm hoạt động mới"}
                  </h3>

                  <label>
                    Tên hoạt động
                    <input
                      value={activityForm.title}
                      onChange={(event) =>
                        updateActivityFormField(
                          "title",
                          event.target.value
                        )
                      }
                      placeholder="Ví dụ: Tham quan Hồ Xuân Hương"
                      maxLength={200}
                      required
                    />
                  </label>

                  <div className="trip-edit-row">
                    <label>
                      Ngày
                      <input
                        type="date"
                        min={toDateInputValue(
                          trip.startDate
                        )}
                        max={toDateInputValue(
                          trip.endDate
                        )}
                        value={activityForm.activityDate}
                        onChange={(event) =>
                          updateActivityFormField(
                            "activityDate",
                            event.target.value
                          )
                        }
                        required
                      />
                    </label>

                    <label>
                      Giờ bắt đầu
                      <input
                        type="time"
                        value={activityForm.startTime}
                        onChange={(event) =>
                          updateActivityFormField(
                            "startTime",
                            event.target.value
                          )
                        }
                        required
                      />
                    </label>

                    <label>
                      Giờ kết thúc
                      <input
                        type="time"
                        value={activityForm.endTime}
                        onChange={(event) =>
                          updateActivityFormField(
                            "endTime",
                            event.target.value
                          )
                        }
                      />
                    </label>
                  </div>

                  <label>
                    Địa điểm
                    <input
                      value={activityForm.location}
                      onChange={(event) =>
                        updateActivityFormField(
                          "location",
                          event.target.value
                        )
                      }
                      placeholder="Địa chỉ hoặc địa điểm"
                      maxLength={200}
                    />
                  </label>

                  <label>
                    Mô tả
                    <textarea
                      value={activityForm.description}
                      onChange={(event) =>
                        updateActivityFormField(
                          "description",
                          event.target.value
                        )
                      }
                      placeholder="Ghi chú cho hoạt động..."
                      rows={3}
                      maxLength={1000}
                    />
                  </label>

                  <label>
                    Chi phí dự kiến (VNĐ)
                    <input
                      type="number"
                      min="0"
                      value={activityForm.estimatedCost}
                      onChange={(event) =>
                        updateActivityFormField(
                          "estimatedCost",
                          event.target.value
                        )
                      }
                      placeholder="0"
                    />
                  </label>

                  <div className="trip-edit-actions">
                    <button
                      type="button"
                      onClick={closeActivityForm}
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingActivity}
                    >
                      {isSavingActivity
                        ? "Đang lưu..."
                        : editingActivityId
                          ? "Lưu thay đổi"
                          : "Thêm hoạt động"}
                    </button>
                  </div>
                </form>
              )}

              {isLoadingActivities ? (
                <div className="trip-feature-empty">
                  Đang tải lịch trình...
                </div>
              ) : activities.length === 0 ? (
                <div className="trip-feature-empty">
                  <span>🗓️</span>
                  <strong>Chưa có lịch trình</strong>
                  <p>
                    Nhấn “Thêm hoạt động” để bắt đầu lên
                    kế hoạch cho chuyến đi.
                  </p>
                </div>
              ) : (
                <div className="trip-timeline">
                  {Object.entries(groupedActivities).map(
                    ([date, dateActivities]) => (
                      <section
                        className="trip-timeline-day"
                        key={date}
                      >
                        <h3>🗓️ {formatDate(date)}</h3>

                        <div className="trip-activities-list">
                          {dateActivities.map((activity) => {
                            const canManageActivity =
                              isOwner ||
                              activity.creator._id ===
                                currentUserId;

                            return (
                              <article
                                className="trip-activity-item"
                                key={activity._id}
                              >
                                <div className="activity-time">
                                  <strong>
                                    {activity.startTime}
                                  </strong>
                                  {activity.endTime && (
                                    <span>
                                      – {activity.endTime}
                                    </span>
                                  )}
                                </div>

                                <div className="activity-content">
                                  <h4>{activity.title}</h4>
                                  {activity.location && (
                                    <p>
                                      📍 {activity.location}
                                    </p>
                                  )}
                                  {activity.description && (
                                    <p>{activity.description}</p>
                                  )}
                                  {activity.estimatedCost > 0 && (
                                    <small>
                                      Chi phí: {formatBudget(
                                        activity.estimatedCost
                                      )}
                                    </small>
                                  )}
                                </div>

                                {canManageActivity && (
                                  <div className="activity-actions">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openEditActivityForm(
                                          activity
                                        )
                                      }
                                    >
                                      Sửa
                                    </button>
                                    <button
                                      type="button"
                                      disabled={
                                        deletingActivityId ===
                                        activity._id
                                      }
                                      onClick={() =>
                                        handleDeleteActivity(
                                          activity._id
                                        )
                                      }
                                    >
                                      {deletingActivityId ===
                                      activity._id
                                        ? "Đang xóa..."
                                        : "Xóa"}
                                    </button>
                                  </div>
                                )}
                              </article>
                            );
                          })}
                        </div>
                      </section>
                    )
                  )}
                </div>
              )}
            </article>
          </section>

          <aside className="trip-detail-sidebar">
            {!isOwner && (
              <section className="trip-detail-card join-trip-card">
                <h2>Tham gia chuyến đi</h2>

                {isLoadingJoinRequest ? (
                  <p>Đang kiểm tra trạng thái...</p>
                ) : joinRequestStatus === "member" ? (
                  <div className="join-request-result success">
                    ✅ Bạn đã là thành viên của chuyến đi.
                  </div>
                ) : joinRequestStatus === "pending" ? (
                  <>
                    <div className="join-request-result pending">
                      ⏳ Yêu cầu của bạn đang chờ chủ chuyến
                      đi phản hồi.
                    </div>

                    <button
                      className="cancel-join-request-button"
                      type="button"
                      disabled={isProcessingJoinRequest}
                      onClick={handleCancelJoinRequest}
                    >
                      {isProcessingJoinRequest
                        ? "Đang xử lý..."
                        : "Hủy yêu cầu"}
                    </button>
                  </>
                ) : trip.visibility === "public" &&
                  trip.isLookingForCompanions ? (
                  <>
                    <p>
                      Chuyến đi đang tìm thêm bạn đồng hành.
                      Gửi yêu cầu để chủ chuyến đi xem xét.
                    </p>

                    <button
                      className="send-join-request-button"
                      type="button"
                      disabled={
                        isProcessingJoinRequest ||
                        trip.members.length + 1 >=
                          trip.maxMembers
                      }
                      onClick={handleSendJoinRequest}
                    >
                      {isProcessingJoinRequest
                        ? "Đang gửi..."
                        : trip.members.length + 1 >=
                            trip.maxMembers
                          ? "Chuyến đi đã đủ người"
                          : "Gửi yêu cầu tham gia"}
                    </button>
                  </>
                ) : (
                  <div className="join-request-result closed">
                    Chuyến đi hiện không nhận thêm thành viên.
                  </div>
                )}
              </section>
            )}

            <section className="trip-detail-card">
              <h2>Chủ chuyến đi</h2>
              <Link
                className="trip-member"
                to={`/users/${trip.owner._id}`}
              >
                <div>
                  {trip.owner.avatarUrl ? (
                    <img
                      src={trip.owner.avatarUrl}
                      alt={trip.owner.fullName}
                    />
                  ) : (
                    getFirstLetter(trip.owner.fullName)
                  )}
                </div>
                <span>
                  <strong>{trip.owner.fullName}</strong>
                  <small>Người tổ chức</small>
                </span>
              </Link>
            </section>

            <section className="trip-detail-card">
              <div className="trip-detail-card-heading">
                <div>
                  <h2>Thành viên</h2>
                  <span>
                    {trip.members.length} người
                  </span>
                </div>

                {isOwner && (
                  <button
                    type="button"
                    onClick={() =>
                      setIsInviteMemberOpen(true)
                    }
                  >
                    + Mời
                  </button>
                )}
              </div>

              {trip.members.length === 0 ? (
                <p className="members-empty">
                  Chưa có thành viên tham gia.
                </p>
              ) : (
                <div className="trip-members-list">
                  {trip.members.map((member) => (
                    <Link
                      className="trip-member"
                      key={member._id}
                      to={`/users/${member._id}`}
                    >
                      <div>
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt={member.fullName}
                          />
                        ) : (
                          getFirstLetter(member.fullName)
                        )}
                      </div>
                      <span>
                        <strong>{member.fullName}</strong>
                        <small>Thành viên</small>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {isOwner && (
              <button
                className="delete-trip-detail-button"
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteTrip}
              >
                {isDeleting
                  ? "Đang xóa..."
                  : "🗑️ Xóa chuyến đi"}
              </button>
            )}
          </aside>
        </div>
      </main>

      {isInviteMemberOpen && (
        <InviteTripMemberModal
          tripId={trip._id}
          existingMemberIds={[
            trip.owner._id,
            ...trip.members.map(
              (member) => member._id
            ),
          ]}
          onClose={() =>
            setIsInviteMemberOpen(false)
          }
        />
      )}
    </div>
  );
}

export default TripDetailPage;
