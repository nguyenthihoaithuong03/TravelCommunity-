import {
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  useEffect,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";

import axiosClient from "../api/axiosClient";

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
    } catch (error: unknown) {
      setIsError(true);
      setMessage(getErrorMessage(error, "Không thể cập nhật hồ sơ"));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div style={styles.status}>Đang tải hồ sơ...</div>;
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <Link to="/home" style={styles.brand}>Travel Community</Link>
        <Link to="/home" style={styles.backLink}>Quay lại trang chủ</Link>
      </header>

      <main style={styles.container}>
        <section style={styles.card}>
          <div style={styles.titleBlock}>
            <div style={styles.avatarArea}>
              <div style={styles.avatar}>
                {form.avatarUrl ? (
                  <img
                    src={form.avatarUrl}
                    alt="Ảnh đại diện"
                    style={styles.avatarImage}
                  />
                ) : (
                  <span>{form.fullName.trim().charAt(0).toUpperCase() || "U"}</span>
                )}
              </div>

              <label style={styles.avatarButton}>
                {isUploading ? "Đang tải..." : "Đổi ảnh"}
                <input
                  type="file"
                  accept="image/*"
                  disabled={isUploading}
                  onChange={handleAvatarChange}
                  style={styles.hiddenInput}
                />
              </label>
            </div>

            <div>
              <h1 style={styles.title}>Chỉnh sửa hồ sơ</h1>
              <p style={styles.subtitle}>
                Cập nhật thông tin để mọi người hiểu hơn về bạn.
              </p>
            </div>
          </div>

          {message && (
            <div style={{ ...styles.message, ...(isError ? styles.error : styles.success) }}>
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.sectionHeading}>
              <div>
                <h2 style={styles.sectionTitle}>Thông tin cá nhân</h2>
                <p style={styles.sectionDescription}>Những thông tin cơ bản trên hồ sơ của bạn</p>
              </div>
            </div>
            <div style={styles.twoColumns}>
              <label style={styles.field}>
                <span>Họ và tên *</span>
                <input
                  style={styles.input}
                  name="fullName"
                  value={form.fullName}
                  maxLength={100}
                  required
                  onChange={handleChange}
                />
              </label>

              <label style={styles.field}>
                <span>Email</span>
                <input style={styles.inputDisabled} value={email} disabled />
              </label>

              <label style={styles.field}>
                <span>Ngày sinh</span>
                <input
                  style={styles.input}
                  type="date"
                  name="dateOfBirth"
                  value={form.dateOfBirth}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={handleChange}
                />
              </label>

              <label style={styles.field}>
                <span>Giới tính</span>
                <select style={styles.input} name="gender" value={form.gender} onChange={handleChange}>
                  <option value="">Chưa chọn</option>
                  <option value="female">Nữ</option>
                  <option value="male">Nam</option>
                  <option value="other">Khác</option>
                </select>
              </label>

              <label style={styles.field}>
                <span>Quê quán</span>
                <input
                  style={styles.input}
                  name="hometown"
                  value={form.hometown}
                  maxLength={100}
                  placeholder="Ví dụ: Gia Lai"
                  onChange={handleChange}
                />
              </label>

              <label style={styles.field}>
                <span>Phong cách du lịch</span>
                <select style={styles.input} name="travelStyle" value={form.travelStyle} onChange={handleChange}>
                  <option value="">Chưa chọn</option>
                  <option value="relaxation">Nghỉ dưỡng</option>
                  <option value="exploration">Khám phá</option>
                  <option value="adventure">Phiêu lưu</option>
                </select>
              </label>

              <label style={styles.field}>
                <span>Mức ngân sách</span>
                <select style={styles.input} name="budgetLevel" value={form.budgetLevel} onChange={handleChange}>
                  <option value="">Chưa chọn</option>
                  <option value="low">Tiết kiệm</option>
                  <option value="medium">Trung bình</option>
                  <option value="high">Thoải mái</option>
                </select>
              </label>

            </div>

            <div style={styles.sectionDivider} />

            <div style={styles.sectionHeading}>
              <div>
                <h2 style={styles.sectionTitle}>Sở thích du lịch</h2>
                <p style={styles.sectionDescription}>Chọn một hoặc nhiều sở thích phù hợp với bạn</p>
              </div>
            </div>

            <div style={styles.interestList}>
              {INTEREST_OPTIONS.map((interest) => {
                const isSelected = form.travelInterests.includes(interest);

                return (
                  <button
                    key={interest}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleToggleInterest(interest)}
                    style={{
                      ...styles.interestChip,
                      ...(isSelected ? styles.interestChipSelected : {}),
                    }}
                  >
                    <span>{interest}</span>
                    {isSelected && <span style={styles.checkMark}>✓</span>}
                  </button>
                );
              })}
            </div>

            <div style={styles.sectionDivider} />

            <div style={styles.sectionHeading}>
              <div>
                <h2 style={styles.sectionTitle}>Giới thiệu về bạn</h2>
                <p style={styles.sectionDescription}>Chia sẻ ngắn gọn để kết nối với những người cùng sở thích</p>
              </div>
            </div>

            <label style={styles.field}>
              <textarea
                style={styles.textarea}
                name="bio"
                value={form.bio}
                maxLength={500}
                rows={5}
                placeholder="Chia sẻ đôi chút về bạn..."
                onChange={handleChange}
              />
              <small style={styles.hint}>{form.bio.length}/500 ký tự</small>
            </label>

            <div style={styles.actions}>
              <Link to="/home" style={styles.cancelButton}>Hủy</Link>
              <button
                type="submit"
                disabled={isSaving || isUploading}
                style={{
                  ...styles.saveButton,
                  ...((isSaving || isUploading) ? styles.disabledButton : {}),
                }}
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

const styles: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", background: "linear-gradient(145deg, #f1f8f5 0%, #f8faf9 55%, #edf7f3 100%)", color: "#24332e", fontSize: 18 },
  header: { minHeight: 64, padding: "0 clamp(20px, 3vw, 56px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, background: "#ffffff", borderBottom: "1px solid #dce7e3" },
  brand: { color: "#087f5b", fontSize: 24, fontWeight: 800, textDecoration: "none" },
  backLink: { color: "#3d5a50", fontSize: 18, fontWeight: 700, textDecoration: "none" },
  container: { width: "calc(100% - clamp(28px, 3vw, 52px))", maxWidth: 1600, margin: "24px auto", paddingBottom: 32 },
  card: { background: "rgba(255, 255, 255, 0.98)", border: "1px solid #dce8e4", borderRadius: 18, boxShadow: "0 12px 36px rgba(31, 73, 59, 0.08)", padding: "clamp(24px, 2.5vw, 40px)" },
  titleBlock: { display: "flex", justifyContent: "flex-start", alignItems: "center", flexWrap: "wrap", gap: 22, padding: "4px 0 26px", borderBottom: "1px solid #e5eeeb" },
  title: { margin: "0 0 7px", fontSize: "clamp(32px, 3vw, 40px)", letterSpacing: "-0.02em" },
  subtitle: { margin: 0, color: "#6a7e77", fontSize: 18 },
  avatarArea: { display: "flex", alignItems: "center", gap: 12 },
  avatar: { width: 80, height: 80, borderRadius: "50%", overflow: "hidden", background: "#d7f1e8", color: "#087f5b", display: "grid", placeItems: "center", fontSize: 32, fontWeight: 800, border: "3px solid #bfe7da" },
  avatarImage: { width: "100%", height: "100%", objectFit: "cover" },
  avatarButton: { padding: "10px 15px", borderRadius: 8, background: "#e6f5ef", color: "#087f5b", fontSize: 17, fontWeight: 700, cursor: "pointer" },
  hiddenInput: { display: "none" },
  message: { marginTop: 22, padding: "12px 15px", borderRadius: 9, fontWeight: 600 },
  success: { background: "#e8f7ef", color: "#167346", border: "1px solid #bde7cf" },
  error: { background: "#fff0f0", color: "#b42318", border: "1px solid #f4c7c7" },
  form: { display: "grid", gap: 20, marginTop: 26 },
  sectionHeading: { display: "flex", alignItems: "stretch", paddingLeft: 14, borderLeft: "4px solid #0a8f65" },
  sectionTitle: { margin: 0, color: "#203b32", fontSize: 24, letterSpacing: "-0.01em" },
  sectionDescription: { margin: "5px 0 0", color: "#788a84", fontSize: 16 },
  sectionDivider: { height: 1, background: "#e7efec", margin: "3px 0" },
  twoColumns: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(400px, 100%), 1fr))", gap: 20 },
  field: { display: "grid", gap: 9, color: "#304b42", fontSize: 18, fontWeight: 700 },
  input: { width: "100%", boxSizing: "border-box", minHeight: 58, border: "1px solid #cbdad5", borderRadius: 10, padding: "13px 16px", background: "#ffffff", color: "#24332e", font: "inherit", fontSize: 18, outlineColor: "#22a77a" },
  inputDisabled: { width: "100%", boxSizing: "border-box", minHeight: 58, border: "1px solid #dce5e2", borderRadius: 10, padding: "13px 16px", background: "#f1f4f3", color: "#71817b", font: "inherit", fontSize: 18 },
  textarea: { width: "100%", boxSizing: "border-box", resize: "vertical", border: "1px solid #cbdad5", borderRadius: 10, padding: "14px 16px", background: "#ffffff", color: "#24332e", font: "inherit", fontSize: 18, lineHeight: 1.6, outlineColor: "#22a77a" },
  hint: { color: "#768982", fontWeight: 400 },
  interestList: { display: "flex", flexWrap: "wrap", gap: 12 },
  interestChip: { minHeight: 48, display: "inline-flex", alignItems: "center", gap: 9, padding: "10px 18px", borderRadius: 999, border: "1px solid #cdded8", background: "#f7faf9", color: "#38534a", font: "inherit", fontSize: 18, fontWeight: 700, cursor: "pointer", transition: "all 0.2s ease" },
  interestChipSelected: { borderColor: "#0a8f65", background: "#e0f4ed", color: "#067654", boxShadow: "0 3px 10px rgba(10, 143, 101, 0.10)" },
  checkMark: { width: 20, height: 20, display: "grid", placeItems: "center", borderRadius: "50%", background: "#0a8f65", color: "#ffffff", fontSize: 12 },
  actions: { display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, paddingTop: 4 },
  cancelButton: { padding: "12px 20px", borderRadius: 9, color: "#40564e", background: "#edf2f0", fontSize: 18, fontWeight: 700, textDecoration: "none" },
  saveButton: { border: 0, borderRadius: 9, padding: "13px 22px", background: "#0a8f65", color: "#ffffff", font: "inherit", fontSize: 18, fontWeight: 800, cursor: "pointer" },
  disabledButton: { opacity: 0.6, cursor: "not-allowed" },
  status: { minHeight: "100vh", display: "grid", placeItems: "center", background: "#f4f8f7", color: "#526b62", fontSize: 18 },
};

export default ProfilePage;
