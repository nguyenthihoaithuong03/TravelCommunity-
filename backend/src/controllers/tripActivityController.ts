import type { Response } from "express";
import mongoose from "mongoose";

import type {
  AuthRequest,
} from "../middlewares/authMiddleware.js";
import Trip from "../models/Trip.js";
import TripActivity from "../models/TripActivity.js";

interface ActivityBody {
  activityDate?: string;
  startTime?: string;
  endTime?: string;
  title?: string;
  location?: string;
  description?: string;
  estimatedCost?: number | string;
  order?: number | string;
}

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const getRouteParam = (
  value: string | string[] | undefined
): string | undefined => {
  return Array.isArray(value) ? value[0] : value;
};

const parseDate = (
  value: string | undefined
): Date | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
};

const startOfDay = (value: Date): Date => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const parseNonNegativeNumber = (
  value: number | string | undefined,
  defaultValue = 0
): number | null => {
  if (value === undefined || value === "") {
    return defaultValue;
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return null;
  }

  return number;
};

// Chủ chuyến đi, thành viên hoặc người xem chuyến công khai
// đều được xem lịch trình.
const findViewableTrip = async (
  tripId: string,
  userId: string
) => {
  return Trip.findOne({
    _id: tripId,
    isActive: true,
    $or: [
      { owner: userId },
      { members: userId },
      { visibility: "public" },
    ],
  }).select(
    "owner members visibility startDate endDate"
  );
};

// Chỉ chủ chuyến đi được thay đổi lịch trình.
const findOwnedTrip = async (
  tripId: string,
  userId: string
) => {
  return Trip.findOne({
    _id: tripId,
    owner: userId,
    isActive: true,
  }).select("owner startDate endDate");
};

const isDateInsideTrip = (
  activityDate: Date,
  startDate: Date,
  endDate: Date
): boolean => {
  const activity = startOfDay(activityDate).getTime();
  const start = startOfDay(startDate).getTime();
  const end = startOfDay(endDate).getTime();

  return activity >= start && activity <= end;
};

// Lấy toàn bộ lịch trình của một chuyến đi.
export const getTripActivities = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;
    const tripId = getRouteParam(req.params.tripId);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập",
      });
    }

    if (
      !tripId ||
      !mongoose.isValidObjectId(tripId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Mã chuyến đi không hợp lệ",
      });
    }

    const trip = await findViewableTrip(
      tripId,
      userId
    );

    if (!trip) {
      return res.status(404).json({
        success: false,
        message:
          "Không tìm thấy chuyến đi hoặc bạn không có quyền xem",
      });
    }

    const activities = await TripActivity.find({
      trip: tripId,
      isActive: true,
    })
      .populate(
        "creator",
        "fullName avatarUrl"
      )
      .sort({
        activityDate: 1,
        startTime: 1,
        order: 1,
        createdAt: 1,
      });

    return res.status(200).json({
      success: true,
      activities,
    });
  } catch (error) {
    console.error("Lỗi lấy lịch trình:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể lấy lịch trình",
    });
  }
};

// Chỉ chủ chuyến đi được thêm hoạt động.
export const createTripActivity = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;
    const tripId = getRouteParam(req.params.tripId);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập",
      });
    }

    if (
      !tripId ||
      !mongoose.isValidObjectId(tripId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Mã chuyến đi không hợp lệ",
      });
    }

    const trip = await findOwnedTrip(
      tripId,
      userId
    );

    if (!trip) {
      return res.status(404).json({
        success: false,
        message:
          "Chỉ chủ chuyến đi được thêm lịch trình",
      });
    }

    const {
      activityDate,
      startTime,
      endTime,
      title,
      location,
      description,
      estimatedCost,
      order,
    } = req.body as ActivityBody;

    const parsedActivityDate =
      parseDate(activityDate);

    if (!parsedActivityDate) {
      return res.status(400).json({
        success: false,
        message: "Ngày hoạt động không hợp lệ",
      });
    }

    if (
      !isDateInsideTrip(
        parsedActivityDate,
        trip.startDate,
        trip.endDate
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Ngày hoạt động phải nằm trong thời gian chuyến đi",
      });
    }

    if (!startTime || !timePattern.test(startTime)) {
      return res.status(400).json({
        success: false,
        message: "Giờ bắt đầu không hợp lệ",
      });
    }

    const normalizedEndTime = endTime?.trim() || "";

    if (
      normalizedEndTime &&
      !timePattern.test(normalizedEndTime)
    ) {
      return res.status(400).json({
        success: false,
        message: "Giờ kết thúc không hợp lệ",
      });
    }

    if (
      normalizedEndTime &&
      normalizedEndTime < startTime
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Giờ kết thúc phải bằng hoặc sau giờ bắt đầu",
      });
    }

    if (!title?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Tên hoạt động không được để trống",
      });
    }

    const parsedCost = parseNonNegativeNumber(
      estimatedCost
    );
    const parsedOrder = parseNonNegativeNumber(order);

    if (parsedCost === null) {
      return res.status(400).json({
        success: false,
        message: "Chi phí dự kiến không hợp lệ",
      });
    }

    if (parsedOrder === null) {
      return res.status(400).json({
        success: false,
        message: "Thứ tự hoạt động không hợp lệ",
      });
    }

    const activity = await TripActivity.create({
      trip: tripId,
      creator: userId,
      activityDate: parsedActivityDate,
      startTime,
      endTime: normalizedEndTime,
      title: title.trim(),
      location: location?.trim() || "",
      description: description?.trim() || "",
      estimatedCost: parsedCost,
      order: parsedOrder,
    });

    await activity.populate(
      "creator",
      "fullName avatarUrl"
    );

    return res.status(201).json({
      success: true,
      message: "Thêm hoạt động thành công",
      activity,
    });
  } catch (error) {
    console.error("Lỗi thêm hoạt động:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể thêm hoạt động",
    });
  }
};

// Chỉ chủ chuyến đi được sửa hoạt động.
export const updateTripActivity = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;
    const activityId = getRouteParam(
      req.params.activityId
    );

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập",
      });
    }

    if (
      !activityId ||
      !mongoose.isValidObjectId(activityId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Mã hoạt động không hợp lệ",
      });
    }

    const activity = await TripActivity.findOne({
      _id: activityId,
      isActive: true,
    });

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hoạt động",
      });
    }

    const trip = await findOwnedTrip(
      activity.trip.toString(),
      userId
    );

    if (!trip) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền sửa hoạt động",
      });
    }

    const body = req.body as ActivityBody;
    const updates: Record<string, unknown> = {};

    const nextActivityDate = body.activityDate
      ? parseDate(body.activityDate)
      : activity.activityDate;

    if (
      !nextActivityDate ||
      !isDateInsideTrip(
        nextActivityDate,
        trip.startDate,
        trip.endDate
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Ngày hoạt động phải nằm trong thời gian chuyến đi",
      });
    }

    const nextStartTime =
      body.startTime?.trim() || activity.startTime;
    const nextEndTime =
      body.endTime !== undefined
        ? body.endTime.trim()
        : activity.endTime;

    if (!timePattern.test(nextStartTime)) {
      return res.status(400).json({
        success: false,
        message: "Giờ bắt đầu không hợp lệ",
      });
    }

    if (
      nextEndTime &&
      (!timePattern.test(nextEndTime) ||
        nextEndTime < nextStartTime)
    ) {
      return res.status(400).json({
        success: false,
        message: "Giờ kết thúc không hợp lệ",
      });
    }

    if (body.title !== undefined) {
      if (!body.title.trim()) {
        return res.status(400).json({
          success: false,
          message:
            "Tên hoạt động không được để trống",
        });
      }

      updates.title = body.title.trim();
    }

    if (body.activityDate !== undefined) {
      updates.activityDate = nextActivityDate;
    }

    if (body.startTime !== undefined) {
      updates.startTime = nextStartTime;
    }

    if (body.endTime !== undefined) {
      updates.endTime = nextEndTime;
    }

    if (body.location !== undefined) {
      updates.location = body.location.trim();
    }

    if (body.description !== undefined) {
      updates.description = body.description.trim();
    }

    if (body.estimatedCost !== undefined) {
      const cost = parseNonNegativeNumber(
        body.estimatedCost
      );

      if (cost === null) {
        return res.status(400).json({
          success: false,
          message: "Chi phí dự kiến không hợp lệ",
        });
      }

      updates.estimatedCost = cost;
    }

    if (body.order !== undefined) {
      const order = parseNonNegativeNumber(body.order);

      if (order === null) {
        return res.status(400).json({
          success: false,
          message: "Thứ tự hoạt động không hợp lệ",
        });
      }

      updates.order = order;
    }

    const updatedActivity =
      await TripActivity.findByIdAndUpdate(
        activityId,
        updates,
        {
          new: true,
          runValidators: true,
        }
      ).populate(
        "creator",
        "fullName avatarUrl"
      );

    return res.status(200).json({
      success: true,
      message: "Cập nhật hoạt động thành công",
      activity: updatedActivity,
    });
  } catch (error) {
    console.error("Lỗi sửa hoạt động:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể cập nhật hoạt động",
    });
  }
};

// Chỉ chủ chuyến đi được xóa hoạt động.
export const deleteTripActivity = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;
    const activityId = getRouteParam(
      req.params.activityId
    );

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập",
      });
    }

    if (
      !activityId ||
      !mongoose.isValidObjectId(activityId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Mã hoạt động không hợp lệ",
      });
    }

    const activity = await TripActivity.findOne({
      _id: activityId,
      isActive: true,
    });

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hoạt động",
      });
    }

    const trip = await findOwnedTrip(
      activity.trip.toString(),
      userId
    );

    if (!trip) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xóa hoạt động",
      });
    }

    activity.isActive = false;
    await activity.save();

    return res.status(200).json({
      success: true,
      message: "Xóa hoạt động thành công",
    });
  } catch (error) {
    console.error("Lỗi xóa hoạt động:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể xóa hoạt động",
    });
  }
};