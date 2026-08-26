import type {
  NextFunction,
  Request,
  Response,
} from "express";
import jwt from "jsonwebtoken";

interface JwtPayloadData {
  userId: string;
  email: string;
}

export interface AuthRequest extends Request {
  user?: JwtPayloadData;
}

export const protect = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authorization = req.headers.authorization;

    if (
      !authorization ||
      !authorization.startsWith("Bearer ")
    ) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập",
      });
    }

    const token = authorization.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token không hợp lệ",
      });
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error("Chưa cấu hình JWT_SECRET");
    }

    const decoded = jwt.verify(
      token,
      jwtSecret
    ) as JwtPayloadData;

    req.user = decoded;

    next();
  } catch {
    return res.status(401).json({
      success: false,
      message:
        "Phiên đăng nhập không hợp lệ hoặc đã hết hạn",
    });
  }
};