import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const register = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ họ tên, email và mật khẩu",
      });
      return;
    }

    const existingUser = await User.findOne({
      email: email.toLowerCase(),
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "Email đã được sử dụng",
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      fullName,
      email: email.toLowerCase(),
      password: hashedPassword,
    });

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error("Chưa khai báo JWT_SECRET trong file .env");
    }

    const token = jwt.sign(
      {
        userId: newUser._id,
        role: newUser.role,
      },
      jwtSecret,
      {
        expiresIn: "7d",
      }
    );

    res.status(201).json({
      success: true,
      message: "Đăng ký tài khoản thành công",
      token,
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
        avatarUrl: newUser.avatarUrl,
      },
    });
  } catch (error) {
    console.error("Lỗi đăng ký:", error);

    res.status(500).json({
      success: false,


      message: "Không thể đăng ký tài khoản",
    });
  }
};
export const login = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Vui lòng nhập email và mật khẩu",
      });
      return;
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Email hoặc mật khẩu không chính xác",
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: "Tài khoản đã bị khóa",
      });
      return;
    }

    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordCorrect) {
      res.status(401).json({
        success: false,
        message: "Email hoặc mật khẩu không chính xác",
      });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error("Chưa khai báo JWT_SECRET trong file .env");
    }

    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
      },
      jwtSecret,
      {
        expiresIn: "7d",
      }
    );

    res.status(200).json({
      success: true,
      message: "Đăng nhập thành công",
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    console.error("Lỗi đăng nhập:", error);

    res.status(500).json({
      success: false,
      message: "Không thể đăng nhập",
    });
  }
};