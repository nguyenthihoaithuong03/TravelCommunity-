import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";

import axiosClient from "../api/axiosClient";
import "../styles/profile.css";

type Gender = "male" | "female" | "other" | "";
type TravelStyle = "relaxation" | "exploration" | "adventure" | "";
type BudgetLevel = "low" | "medium" | "high" | "";

interface UserData {
  _id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  dateOfBirth?: string | null;
  gender?: Gender | null;
  hometown?: string;
  bio?: string;
  travelInterests?: string[];
  travelStyle?: TravelStyle | null;
  budgetLevel?: BudgetLevel | null;
}

interface UserResponse {
  success: boolean;
  message?: string;
  user: UserData;
}

interface AvatarResponse extends UserResponse {
  avatarUrl: string;
}

interface ProfileForm {
  fullName: string;
  dateOfBirth: string;
  gender: Gender;
  hometown: string;
  bio: string;
  travelInterests: string[];
  travelStyle: TravelStyle;
  budgetLevel: BudgetLevel;
  avatarUrl: string;
}

const emptyForm: ProfileForm = {
  fullName: "",
  dateOfBirth: "",
  gender: "",
  hometown: "",
  bio: "",
  travelInterests: [],
  travelStyle: "",
  budgetLevel: "",
  avatarUrl: "",
};

const INTEREST_OPTIONS = [
  "Biển",
  "Núi",
  "Ẩm thực",
  "Chụp ảnh",
  "Phượt",
  "Cắm trại",
  "Văn hóa",
  "Nghỉ dưỡng",
] as const;

function getErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (error as {
      response?: { data?: { message?: string }; status?: number };
    }).response;

    return response?.data?.message || fallback;
  }

  return fallback;
}

function toDateInputValue(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

function ProfilePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const updateStoredUser = (user: UserData) => {
    const storedUser = localStorage.getItem("user");
    let previousUser: Record<string, unknown> = {};

    try {
      previousUser = storedUser ? JSON.parse(storedUser) : {};
    } catch {
      previousUser = {};
    }

    localStorage.setItem(
      "user",
      JSON.stringify({
        ...previousUser,
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        avatarUrl: user.avatarUrl || "",
      })
    );
  };

  const putUserInForm = (user: UserData) => {
    setEmail(user.email || "");
    setForm({
      fullName: user.fullName || "",
      dateOfBirth: toDateInputValue(user.dateOfBirth),
      gender: user.gender || "",
      hometown: user.hometown || "",
      bio: user.bio || "",
      travelInterests: user.travelInterests || [],
      travelStyle: user.travelStyle || "",
      budgetLevel: user.budgetLevel || "",
      avatarUrl: user.avatarUrl || "",
    });
  };

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response =
          await axiosClient.get<UserResponse>("/users/me");

        putUserInForm(response.data.user);
      } catch (error: unknown) {
        const status = (error as { response?: { status?: number } })
          ?.response?.status;

        if (status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/login", { replace: true });
          return;
        }

        setIsError(true);
        setMessage(
          getErrorMessage(error, "Không thể tải hồ sơ cá nhân")
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [navigate]);

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setMessage("");
  };

  const handleAvatarChange = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setIsError(true);
      setMessage("Vui lòng chọn một tệp hình ảnh");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setIsError(true);
      setMessage("Ảnh đại diện không được vượt quá 5 MB");
      return;
    }

    try {
      setIsUploading(true);
      setIsError(false);
      setMessage("");

      const data = new FormData();
      data.append("avatar", file);

      const response = await axiosClient.post<AvatarResponse>(
        "/users/avatar",
        data
      );

      setForm((current) => ({
        ...current,
        avatarUrl: response.data.avatarUrl,
      }));
      updateStoredUser(response.data.user);
      setMessage(response.data.message || "Cập nhật ảnh đại diện thành công");
    } catch (error: unknown) {
      setIsError(true);
      setMessage(getErrorMessage(error, "Không thể tải ảnh đại diện"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleInterest = (interest: string) => {
    setForm((current) => ({
      ...current,
      travelInterests: current.travelInterests.includes(interest)
        ? current.travelInterests.filter((item) => item !== interest)
        : [...current.travelInterests, interest],
    }));
    setMessage("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (form.fullName.trim().length < 2) {
      setIsError(true);
      setMessage("Họ và tên phải có ít nhất 2 ký tự");
      return;
    }

    if (form.bio.trim().length > 500) {
      setIsError(true);
      setMessage("Giới thiệu không được vượt quá 500 ký tự");
      return;
    }

    try {
      setIsSaving(true);
      setIsError(false);
      setMessage("");

      const response = await axiosClient.put<UserResponse>(
        "/users/me",
        {
          fullName: form.fullName.trim(),
          dateOfBirth: form.dateOfBirth,
          gender: form.gender,
          hometown: form.hometown.trim(),
          bio: form.bio.trim(),
          travelInterests: form.travelInterests,
          travelStyle: form.travelStyle,
          budgetLevel: form.budgetLevel,
          avatarUrl: form.avatarUrl,
        }
      );

      putUserInForm(response.data.user);
      updateStoredUser(response.data.user);
      setMessage(response.data.message || "Cập nhật hồ sơ thành công");

      window.setTimeout(() => {
        navigate(`/users/${response.data.user._id}`);
      }, 1200);
    } catch (error: unknown) {
      setIsError(true);
      setMessage(getErrorMessage(error, "Không thể cập nhật hồ sơ"));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="edit-profile-status">Đang tải hồ sơ...</div>;
  }

  return (
    <div className="edit-profile-page">
      <header className="edit-profile-header">
        <Link to="/home" className="edit-profile-brand">Travel Community</Link>
        <Link to="/home" className="edit-profile-back-link">Quay lại trang chủ</Link>
      </header>

      <main className="edit-profile-container">
        <section className="edit-profile-card">
          <div className="edit-profile-title-block">
            <div className="edit-profile-avatar-area">
              <div className="edit-profile-avatar">
                {form.avatarUrl ? (
                  <img
                    src={form.avatarUrl}
                    alt="Ảnh đại diện"
                    className="edit-profile-avatar-image"
                  />
                ) : (
                  <span>{form.fullName.trim().charAt(0).toUpperCase() || "U"}</span>
                )}
              </div>

              <label className="edit-profile-avatar-button">
                {isUploading ? "Đang tải..." : "Đổi ảnh"}
                <input
                  type="file"
                  accept="image/*"
                  disabled={isUploading}
                  onChange={handleAvatarChange}
                  className="edit-profile-hidden-input"
                />
              </label>
            </div>

            <div>
              <h1 className="edit-profile-title">Chỉnh sửa hồ sơ</h1>
              <p className="edit-profile-subtitle">
                Cập nhật thông tin để mọi người hiểu hơn về bạn.
              </p>
            </div>
          </div>

          {message && (
            <div className={`edit-profile-message ${isError ? "error" : "success"}`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="edit-profile-form">
            <div className="edit-profile-section-heading">
              <div>
                <h2 className="edit-profile-section-title">Thông tin cá nhân</h2>
                <p className="edit-profile-section-description">Những thông tin cơ bản trên hồ sơ của bạn</p>
              </div>
            </div>
            <div className="edit-profile-fields-grid">
              <label className="edit-profile-field">
                <span>Họ và tên *</span>
                <input
                  className="edit-profile-input"
                  name="fullName"
                  value={form.fullName}
                  maxLength={100}
                  required
                  onChange={handleChange}
                />
              </label>

              <label className="edit-profile-field">
                <span>Email</span>
                <input className="edit-profile-input disabled" value={email} disabled />
              </label>

              <label className="edit-profile-field">
                <span>Ngày sinh</span>
                <input
                  className="edit-profile-input"
                  type="date"
                  name="dateOfBirth"
                  value={form.dateOfBirth}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={handleChange}
                />
              </label>

              <label className="edit-profile-field">
                <span>Giới tính</span>
                <select className="edit-profile-input" name="gender" value={form.gender} onChange={handleChange}>
                  <option value="">Chưa chọn</option>
                  <option value="female">Nữ</option>
                  <option value="male">Nam</option>
                  <option value="other">Khác</option>
                </select>
              </label>

              <label className="edit-profile-field">
                <span>Quê quán</span>
                <input
                  className="edit-profile-input"
                  name="hometown"
                  value={form.hometown}
                  maxLength={100}
                  placeholder="Ví dụ: Gia Lai"
                  onChange={handleChange}
                />
              </label>

              <label className="edit-profile-field">
                <span>Phong cách du lịch</span>
                <select className="edit-profile-input" name="travelStyle" value={form.travelStyle} onChange={handleChange}>
                  <option value="">Chưa chọn</option>
                  <option value="relaxation">Nghỉ dưỡng</option>
                  <option value="exploration">Khám phá</option>
                  <option value="adventure">Phiêu lưu</option>
                </select>
              </label>

              <label className="edit-profile-field">
                <span>Mức ngân sách</span>
                <select className="edit-profile-input" name="budgetLevel" value={form.budgetLevel} onChange={handleChange}>
                  <option value="">Chưa chọn</option>
                  <option value="low">Tiết kiệm</option>
                  <option value="medium">Trung bình</option>
                  <option value="high">Thoải mái</option>
                </select>
              </label>

            </div>

            <div className="edit-profile-section-divider" />

            <div className="edit-profile-section-heading">
              <div>
                <h2 className="edit-profile-section-title">Sở thích du lịch</h2>
                <p className="edit-profile-section-description">Chọn một hoặc nhiều sở thích phù hợp với bạn</p>
              </div>
            </div>

            <div className="edit-profile-interest-list">
              {INTEREST_OPTIONS.map((interest) => {
                const isSelected = form.travelInterests.includes(interest);

                return (
                  <button
                    key={interest}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleToggleInterest(interest)}
                    className={`edit-profile-interest-chip ${isSelected ? "selected" : ""}`}
                  >
                    <span>{interest}</span>
                    {isSelected && <span className="edit-profile-check-mark">✓</span>}
                  </button>
                );
              })}
            </div>

            <div className="edit-profile-section-divider" />

            <div className="edit-profile-section-heading">
              <div>
                <h2 className="edit-profile-section-title">Giới thiệu về bạn</h2>
                <p className="edit-profile-section-description">Chia sẻ ngắn gọn để kết nối với những người cùng sở thích</p>
              </div>
            </div>

            <label className="edit-profile-field">
              <textarea
                className="edit-profile-textarea"
                name="bio"
                value={form.bio}
                maxLength={500}
                rows={5}
                placeholder="Chia sẻ đôi chút về bạn..."
                onChange={handleChange}
              />
              <small className="edit-profile-hint">{form.bio.length}/500 ký tự</small>
            </label>

            <div className="edit-profile-actions">
              <Link to="/home" className="edit-profile-cancel-button">Hủy</Link>
              <button
                type="submit"
                disabled={isSaving || isUploading}
                className="edit-profile-save-button"
              >
                {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

export default ProfilePage;
