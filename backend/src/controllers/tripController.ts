import type { Response } from "express";
import mongoose from "mongoose";

import type {
  AuthRequest,
} from "../middlewares/authMiddleware.js";
import Post from "../models/Post.js";
import Trip, {
  type ITrip,
} from "../models/Trip.js";

type TripStatus =
  | "planning"
  | "ongoing"
  | "completed"
  | "cancelled";

type TripVisibility = "private" | "public";

interface TripBody {
  title?: string;
  destination?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  budget?: number | string;
  coverImageUrl?: string;
  status?: TripStatus;
  visibility?: TripVisibility;
  isLookingForCompanions?: boolean;
  maxMembers?: number | string;
}

const allowedStatuses: TripStatus[] = [
  "planning",
  "ongoing",
  "completed",
  "cancelled",
];

const allowedVisibilities: TripVisibility[] = [
  "private",
  "public",
];

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

const parseBudget = (
  value: number | string | undefined
): number | null => {
  if (
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const budget = Number(value);

  if (!Number.isFinite(budget) || budget < 0) {
    return null;
  }

  return budget;
};

const parseMaxMembers = (
  value: number | string | undefined
): number | null => {
  if (value === undefined || value === "") {
    return 4;
  }

  const maxMembers = Number(value);

  if (
    !Number.isInteger(maxMembers) ||
    maxMembers < 2 ||
    maxMembers > 100
  ) {
    return null;
  }

  return maxMembers;
};

// Đồng bộ chuyến đi tìm bạn đồng hành với bảng tin chung.
// Mỗi chuyến đi chỉ có một bài viết companion_trip.
const syncCompanionPost = async (
  trip: ITrip,
  ownerId: string
): Promise<void> => {
  const shouldShowOnFeed =
    trip.isActive &&
    trip.visibility === "public" &&
    trip.isLookingForCompanions;

  if (!shouldShowOnFeed) {
    await Post.updateMany(
      {
        trip: trip._id,
        postType: "companion_trip",
      },
      {
        $set: { isActive: false },
      }
    );

    return;
  }

  const postContent =
    trip.description.trim() ||
    `Mình đang tìm bạn đồng hành cho chuyến đi ${trip.title} đến ${trip.destination}.`;

  await Post.findOneAndUpdate(
    {
      trip: trip._id,
      postType: "companion_trip",
    },
    {
      $set: {
        author: ownerId,
        content: postContent,
        imageUrls: trip.coverImageUrl
          ? [trip.coverImageUrl]
          : [],
        location: trip.destination,
        postType: "companion_trip",
        trip: trip._id,
        isActive: true,
      },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );
};

// Tạo chuyến đi mới.
export const createTrip = async (
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

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(401).json({
        success: false,
        message: "Thông tin đăng nhập không hợp lệ",
      });
    }

    const {
      title,
      destination,
      description,
      startDate,
      endDate,
      budget,
      coverImageUrl,
      status,
      visibility,
      isLookingForCompanions,
      maxMembers,
    } = req.body as TripBody;

    if (!title?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Tên chuyến đi không được để trống",
      });
    }

    if (!destination?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Điểm đến không được để trống",
      });
    }

    const parsedStartDate = parseDate(startDate);
    const parsedEndDate = parseDate(endDate);

    if (!parsedStartDate || !parsedEndDate) {
      return res.status(400).json({
        success: false,
        message:
          "Ngày bắt đầu hoặc ngày kết thúc không hợp lệ",
      });
    }

    if (parsedEndDate < parsedStartDate) {
      return res.status(400).json({
        success: false,
        message:
          "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu",
      });
    }

    const parsedBudget = parseBudget(budget);

    if (parsedBudget === null) {
      return res.status(400).json({
        success: false,
        message: "Ngân sách không hợp lệ",
      });
    }

    if (
      status &&
      !allowedStatuses.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái chuyến đi không hợp lệ",
      });
    }

    if (
      visibility &&
      !allowedVisibilities.includes(visibility)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Quyền hiển thị chuyến đi không hợp lệ",
      });
    }

    const parsedMaxMembers =
      parseMaxMembers(maxMembers);

    if (parsedMaxMembers === null) {
      return res.status(400).json({
        success: false,
        message:
          "Số người tối đa phải là số nguyên từ 2 đến 100",
      });
    }

    const nextVisibility =
      visibility || "private";

    const nextLookingForCompanions =
      isLookingForCompanions === true;

    if (
      nextLookingForCompanions &&
      nextVisibility !== "public"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Chuyến đi phải được công khai khi tìm bạn đồng hành",
      });
    }

    const trip = await Trip.create({
      owner: userId,
      title: title.trim(),
      destination: destination.trim(),
      description: description?.trim() || "",
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      budget: parsedBudget,
      coverImageUrl: coverImageUrl?.trim() || "",
      status: status || "planning",
      members: [],
      visibility: nextVisibility,
      isLookingForCompanions:
        nextLookingForCompanions,
      maxMembers: parsedMaxMembers,
    });

    await syncCompanionPost(trip, userId);

    await trip.populate(
      "owner",
      "fullName email avatarUrl"
    );

    return res.status(201).json({
      success: true,
      message: "Tạo chuyến đi thành công",
      trip,
    });
  } catch (error) {
    console.error("Lỗi tạo chuyến đi:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể tạo chuyến đi",
    });
  }
};

// Lấy các chuyến đi do mình tạo hoặc đang tham gia.
export const getMyTrips = async (
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

    const trips = await Trip.find({
      isActive: true,
      $or: [
        { owner: userId },
        { members: userId },
      ],
    })
      .populate(
        "owner",
        "fullName email avatarUrl"
      )
      .populate(
        "members",
        "fullName email avatarUrl"
      )
      .sort({ startDate: 1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      trips,
    });
  } catch (error) {
    console.error(
      "Lỗi lấy danh sách chuyến đi:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách chuyến đi",
    });
  }
};

// Lấy các chuyến đi công khai đang tìm bạn đồng hành.
export const getCompanionTrips = async (
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

    const destinationValue =
      req.query.destination;

    const destination = Array.isArray(
      destinationValue
    )
      ? String(destinationValue[0] || "").trim()
      : String(destinationValue || "").trim();

    const query: Record<string, unknown> = {
      isActive: true,
      visibility: "public",
      isLookingForCompanions: true,
      status: {
        $in: ["planning", "ongoing"],
      },
      startDate: {
        $gte: new Date(),
      },

      // members không chứa chủ chuyến đi,
      // vì vậy cộng thêm 1 khi kiểm tra số chỗ.
      $expr: {
        $lt: [
          {
            $add: [
              {
                $size: {
                  $ifNull: ["$members", []],
                },
              },
              1,
            ],
          },
          "$maxMembers",
        ],
      },
    };

    if (destination) {
      const escapedDestination =
        destination.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );

      query.destination = {
        $regex: escapedDestination,
        $options: "i",
      };
    }

    const foundTrips = await Trip.find(query)
      .populate(
        "owner",
        "fullName avatarUrl hometown travelInterests travelStyle budgetLevel"
      )
      .populate(
        "members",
        "fullName avatarUrl"
      )
      .sort({ startDate: 1, createdAt: -1 })
      .limit(50);

    return res.status(200).json({
      success: true,
      trips: foundTrips,
    });
  } catch (error) {
    console.error(
      "Lỗi lấy chuyến đi tìm bạn đồng hành:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Không thể lấy danh sách chuyến đi tìm bạn đồng hành",
    });
  }
};

// Xem chi tiết một chuyến đi.
export const getTripById = async (
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

    const trip = await Trip.findOne({
      _id: tripId,
      isActive: true,
      $or: [
        { owner: userId },
        { members: userId },
        { visibility: "public" },
      ],
    })
      .populate(
        "owner",
        "fullName email avatarUrl"
      )
      .populate(
        "members",
        "fullName email avatarUrl"
      );

    if (!trip) {
      return res.status(404).json({
        success: false,
        message:
          "Không tìm thấy chuyến đi hoặc bạn không có quyền xem",
      });
    }

    return res.status(200).json({
      success: true,
      trip,
    });
  } catch (error) {
    console.error(
      "Lỗi lấy chi tiết chuyến đi:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Không thể lấy chi tiết chuyến đi",
    });
  }
};

// Chỉ chủ chuyến đi được phép chỉnh sửa.
export const updateTrip = async (
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

    const existingTrip = await Trip.findOne({
      _id: tripId,
      owner: userId,
      isActive: true,
    });

    if (!existingTrip) {
      return res.status(404).json({
        success: false,
        message:
          "Không tìm thấy chuyến đi hoặc bạn không có quyền sửa",
      });
    }

    const body = req.body as TripBody;
    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) {
      if (!body.title.trim()) {
        return res.status(400).json({
          success: false,
          message: "Tên chuyến đi không được để trống",
        });
      }

      updates.title = body.title.trim();
    }

    if (body.destination !== undefined) {
      if (!body.destination.trim()) {
        return res.status(400).json({
          success: false,
          message: "Điểm đến không được để trống",
        });
      }

      updates.destination =
        body.destination.trim();
    }

    if (body.description !== undefined) {
      updates.description = body.description.trim();
    }

    if (body.coverImageUrl !== undefined) {
      updates.coverImageUrl =
        body.coverImageUrl.trim();
    }

    if (body.budget !== undefined) {
      const budget = parseBudget(body.budget);

      if (budget === null) {
        return res.status(400).json({
          success: false,
          message: "Ngân sách không hợp lệ",
        });
      }

      updates.budget = budget;
    }

    const nextStartDate = body.startDate
      ? parseDate(body.startDate)
      : existingTrip.startDate;

    const nextEndDate = body.endDate
      ? parseDate(body.endDate)
      : existingTrip.endDate;

    if (!nextStartDate || !nextEndDate) {
      return res.status(400).json({
        success: false,
        message:
          "Ngày bắt đầu hoặc ngày kết thúc không hợp lệ",
      });
    }

    if (nextEndDate < nextStartDate) {
      return res.status(400).json({
        success: false,
        message:
          "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu",
      });
    }

    if (body.startDate !== undefined) {
      updates.startDate = nextStartDate;
    }

    if (body.endDate !== undefined) {
      updates.endDate = nextEndDate;
    }

    if (body.status !== undefined) {
      if (!allowedStatuses.includes(body.status)) {
        return res.status(400).json({
          success: false,
          message: "Trạng thái chuyến đi không hợp lệ",
        });
      }

      updates.status = body.status;
    }

    if (body.visibility !== undefined) {
      if (
        !allowedVisibilities.includes(
          body.visibility
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Quyền hiển thị chuyến đi không hợp lệ",
        });
      }

      updates.visibility = body.visibility;
    }

    if (
      body.isLookingForCompanions !== undefined
    ) {
      if (
        typeof body.isLookingForCompanions !==
        "boolean"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Trạng thái tìm bạn đồng hành không hợp lệ",
        });
      }

      updates.isLookingForCompanions =
        body.isLookingForCompanions;
    }

    if (body.maxMembers !== undefined) {
      const maxMembers = parseMaxMembers(
        body.maxMembers
      );

      if (maxMembers === null) {
        return res.status(400).json({
          success: false,
          message:
            "Số người tối đa phải là số nguyên từ 2 đến 100",
        });
      }

      const currentMemberCount =
        existingTrip.members.length + 1;

      if (maxMembers < currentMemberCount) {
        return res.status(400).json({
          success: false,
          message:
            "Số người tối đa không được nhỏ hơn số người hiện tại",
        });
      }

      updates.maxMembers = maxMembers;
    }

    const nextVisibility =
      body.visibility ??
      existingTrip.visibility ??
      "private";

    const nextLookingForCompanions =
      body.isLookingForCompanions ??
      existingTrip.isLookingForCompanions ??
      false;

    if (
      nextLookingForCompanions &&
      nextVisibility !== "public"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Chuyến đi phải được công khai khi tìm bạn đồng hành",
      });
    }

    const trip = await Trip.findOneAndUpdate(
      {
        _id: tripId,
        owner: userId,
        isActive: true,
      },
      updates,
      {
        new: true,
        runValidators: true,
      }
    )
      .populate(
        "owner",
        "fullName email avatarUrl"
      )
      .populate(
        "members",
        "fullName email avatarUrl"
      );

    if (!trip) {
      return res.status(404).json({
        success: false,
        message:
          "Không tìm thấy chuyến đi hoặc bạn không có quyền sửa",
      });
    }

    await syncCompanionPost(trip, userId);

    return res.status(200).json({
      success: true,
      message: "Cập nhật chuyến đi thành công",
      trip,
    });
  } catch (error) {
    console.error("Lỗi sửa chuyến đi:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể cập nhật chuyến đi",
    });
  }
};

// Xóa mềm chuyến đi; dữ liệu vẫn còn trong MongoDB.
export const deleteTrip = async (
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

    const trip = await Trip.findOneAndUpdate(
      {
        _id: tripId,
        owner: userId,
        isActive: true,
      },
      {
        isActive: false,
      },
      {
        new: true,
      }
    );

    if (!trip) {
      return res.status(404).json({
        success: false,
        message:
          "Không tìm thấy chuyến đi hoặc bạn không có quyền xóa",
      });
    }

    await syncCompanionPost(trip, userId);

    return res.status(200).json({
      success: true,
      message: "Xóa chuyến đi thành công",
    });
  } catch (error) {
    console.error("Lỗi xóa chuyến đi:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể xóa chuyến đi",
    });
  }
};