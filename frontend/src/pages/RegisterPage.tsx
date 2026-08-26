import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import axiosClient from "../api/axiosClient";
import "../styles/auth.css";

function RegisterPage() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    if (password !== confirmPassword) {
      setMessage("Mật khẩu xác nhận không khớp");
      return;
    }

    try {
      setIsLoading(true);

      await axiosClient.post("/auth/register", {
        fullName,
        email,
        password,
      });

      alert("Đăng ký tài khoản thành công");
      navigate("/login");
    } catch (error: any) {
      setMessage(
        error.response?.data?.message || "Không thể đăng ký tài khoản"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
  <div className="auth-page">
    <div className="auth-container">
      <h1 className="auth-logo">Travel Community</h1>

      <p className="auth-description">
        Tạo tài khoản để chia sẻ trải nghiệm và tìm kiếm
        người bạn đồng hành phù hợp.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="fullName">Họ và tên</label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Nhập họ và tên"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Nhập địa chỉ email"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Mật khẩu</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Tối thiểu 6 ký tự"
            minLength={6}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">
            Xác nhận mật khẩu
          </label>

          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(event) =>
              setConfirmPassword(event.target.value)
            }
            placeholder="Nhập lại mật khẩu"
            required
          />
        </div>

        {message && (
          <div className="auth-message">{message}</div>
        )}

        <button
          className="auth-button"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? "Đang đăng ký..." : "Đăng ký"}
        </button>
      </form>

      <p className="auth-switch">
        Đã có tài khoản?{" "}
        <Link to="/login">Đăng nhập</Link>
      </p>
    </div>
  </div>
);
}
export default RegisterPage;