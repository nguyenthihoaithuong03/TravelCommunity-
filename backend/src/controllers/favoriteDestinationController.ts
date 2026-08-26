import type { Response } from "express";

import type {
  AuthRequest,
} from "../middlewares/authMiddleware.js";

import User from "../models/User.js";

interface FavoriteDestinationBody {
  name?: string;
  address?: string;
  imageUrl?: string;
  latitude?: number | null;
  longitude?: number | null;
}

const normalizeText = (
  value: string
): string => {
  return value
    .trim()
    .toLocaleLowerCase("vi")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ");
};

// Lấy danh sách địa điểm yêu thích.
export const getFavoriteDestinations = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập",
      });
    }

    const user = await User.findOne({
      _id: userId,
      isActive: true,
    }).select("favoriteDestinations");

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "Không tìm thấy tài khoản người dùng",
      });
    }

    const favoriteDestinations = [
      ...(user.favoriteDestinations || []),
    ].sort((firstDestination, secondDestination) => {
      return (
        new Date(
          secondDestination.savedAt
        ).getTime() -
        new Date(
          firstDestination.savedAt
        ).getTime()
      );
    });

    return res.status(200).json({
      success: true,
      favoriteDestinations,
      total: favoriteDestinations.length,
    });
  } catch (error) {
    console.error(
      "Lỗi lấy danh sách địa điểm yêu thích:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Không thể lấy danh sách địa điểm yêu thích",
    });
  }
};

// Lưu hoặc bỏ lưu một địa điểm.
export const toggleFavoriteDestination = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập",
      });
    }

    const {
      name,
      address,
      imageUrl,
      latitude,
      longitude,
    } = req.body as FavoriteDestinationBody;

    if (
      typeof name !== "string" ||
      !name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Tên địa điểm không được để trống",
      });
    }

    const destinationName = name.trim();

    if (destinationName.length > 200) {
      return res.status(400).json({
        success: false,
        message:
          "Tên địa điểm không được vượt quá 200 ký tự",
      });
    }

    if (
      address !== undefined &&
      typeof address !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Địa chỉ không hợp lệ",
      });
    }

    if (
      typeof address === "string" &&
      address.trim().length > 500
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Địa chỉ không được vượt quá 500 ký tự",
      });
    }

    if (
      imageUrl !== undefined &&
      typeof imageUrl !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Đường dẫn hình ảnh không hợp lệ",
      });
    }

    const hasLatitude =
      latitude !== undefined &&
      latitude !== null;

    const hasLongitude =
      longitude !== undefined &&
      longitude !== null;

    if (
      hasLatitude &&
      (
        typeof latitude !== "number" ||
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Vĩ độ địa điểm không hợp lệ",
      });
    }

    if (
      hasLongitude &&
      (
        typeof longitude !== "number" ||
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Kinh độ địa điểm không hợp lệ",
      });
    }

    const user = await User.findOne({
      _id: userId,
      isActive: true,
    }).select("favoriteDestinations");

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "Không tìm thấy tài khoản người dùng",
      });
    }

    const currentDestinations =
      user.favoriteDestinations || [];

    const normalizedName = normalizeText(
      destinationName
    );

    const existingDestination =
      currentDestinations.find(
        (destination) => {
          return (
            normalizeText(
              destination.name
            ) === normalizedName
          );
        }
      );

    if (existingDestination) {
      user.favoriteDestinations =
        currentDestinations.filter(
          (destination) => {
            return (
              normalizeText(
                destination.name
              ) !== normalizedName
            );
          }
        );

      await user.save();

      return res.status(200).json({
        success: true,
        message:
          "Đã bỏ lưu địa điểm yêu thích",
        isSaved: false,
        favoriteDestinations:
          user.favoriteDestinations,
      });
    }

    user.favoriteDestinations = [
      ...currentDestinations,
      {
        name: destinationName,
        address: address?.trim() || "",
        imageUrl: imageUrl?.trim() || "",
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        savedAt: new Date(),
      },
    ];

    await user.save();

    return res.status(200).json({
      success: true,
      message:
        "Đã lưu địa điểm vào danh sách yêu thích",
      isSaved: true,
      favoriteDestinations:
        user.favoriteDestinations,
    });
  } catch (error) {
    console.error(
      "Lỗi lưu địa điểm yêu thích:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Không thể cập nhật địa điểm yêu thích",
    });
  }
};