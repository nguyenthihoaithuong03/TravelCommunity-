import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import axiosClient from "../api/axiosClient";
import "../styles/auth.css";

interface LoginResponse {
  success: boolean;
  message: string;
  token: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    avatarUrl: string;
  };
}

function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    try {
      setIsLoading(true);

      const response = await axiosClient.post<LoginResponse>(
        "/auth/login",
        {
          email,
          password,
        }
      );

      localStorage.setItem("token", response.data.token);
      localStorage.setItem(
        "user",
        JSON.stringify(response.data.user)
      );

      navigate("/home");
    } catch (error: any) {
      setMessage(
        error.response?.data?.message ||
          "Không thể đăng nhập tài khoản"
      );
    } finally {
      setIsLoading(false);
    }
  };

 return (
  <div className="auth-page">
    <div className="auth-container">
      <h1 className="auth-logo">Travel Community</h1>

      <h2 className="auth-title">Đăng nhập</h2>

      <p className="auth-description">
        Đăng nhập để kết nối bạn bè và khám phá những
        hành trình mới.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email</label>

          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
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
            onChange={(event) =>
              setPassword(event.target.value)
            }
            placeholder="Nhập mật khẩu"
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
          {isLoading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>

      <p className="auth-switch">
        Chưa có tài khoản?{" "}
        <Link to="/register">Đăng ký ngay</Link>
      </p>
    </div>
  </div>
);
}

export default LoginPage;