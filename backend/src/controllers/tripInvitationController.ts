import mongoose from "mongoose";
import type { Response } from "express";

import type {
  AuthRequest,
} from "../middlewares/authMiddleware.js";
import Trip from "../models/Trip.js";
import TripInvitation from "../models/TripInvitation.js";
import User from "../models/User.js";
import Notification, {
  type NotificationType,
} from "../models/Notification.js";
import { getSocketIO } from "../config/socket.js";

interface SendInvitationBody {
  recipientId?: string;
  message?: string;
}

interface SendJoinRequestBody {
  message?: string;
}

const getParamValue = (
  value: string | string[] | undefined
): string => {
  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return value || "";
};

const invitationPopulate = [
  {
    path: "trip",
    select:
      "title destination startDate endDate coverImageUrl status visibility isLookingForCompanions maxMembers members owner",
  },
  {
    path: "sender",
    select: "fullName avatarUrl",
  },
  {
    path: "recipient",
    select: "fullName avatarUrl",
  },
];

interface TripNotificationInput {
  recipientId: string;
  senderId: string;
  tripId: string;
  type: NotificationType;
  message: string;
}

const createTripNotification = async ({
  recipientId,
  senderId,
  tripId,
  type,
  message,
}: TripNotificationInput) => {
  if (recipientId === senderId) return;

  const notification = await Notification.create({
    recipient: recipientId,
    sender: senderId,
    type,
    trip: tripId,
    post: null,
    comment: null,
    message,
  });

  await notification.populate(
    "sender",
    "fullName avatarUrl"
  );

  getSocketIO()
    ?.to(`user:${recipientId}`)
    .emit("new-notification", { notification });
};

const getUserDisplayName = async (
  userId: string
) => {
  const user = await User.findById(userId).select(
    "fullName"
  );

  return user?.fullName || "Một người dùng";
};

// Chủ chuyến đi gửi lời mời cho người khác.
export const sendTripInvitation = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;
    const tripId = getParamValue(
      req.params.tripId
    );

    const {
      recipientId,
      message,
    } = req.body as SendInvitationBody;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập",
      });
    }

    if (
      !mongoose.isValidObjectId(tripId) ||
      !recipientId ||
      !mongoose.isValidObjectId(recipientId)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Mã chuyến đi hoặc người nhận không hợp lệ",
      });
    }

    if (recipientId === userId) {
      return res.status(400).json({
        success: false,
        message: "Bạn không thể tự mời chính mình",
      });
    }

    const trip = await Trip.findOne({
      _id: tripId,
      owner: userId,
      isActive: true,
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message:
          "Không tìm thấy chuyến đi hoặc bạn không phải chủ chuyến đi",
      });
    }

    if (trip.members.length + 1 >= trip.maxMembers) {
      return res.status(400).json({
        success: false,
        message: "Chuyến đi đã đủ thành viên",
      });
    }

    const recipient = await User.findOne({
      _id: recipientId,
      isActive: true,
    });

    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tài khoản được mời",
      });
    }

    const isAlreadyMember = trip.members.some(
      (memberId) =>
        memberId.toString() === recipientId
    );

    if (isAlreadyMember) {
      return res.status(400).json({
        success: false,
        message:
          "Người này đã là thành viên của chuyến đi",
      });
    }

    const existingInvitation =
      await TripInvitation.findOne({
        trip: tripId,
        recipient: recipientId,
        requestType: "invite",
        status: "pending",
      });

    if (existingInvitation) {
      return res.status(400).json({
        success: false,
        message: "Bạn đã gửi lời mời cho người này",
      });
    }

    const invitation =
      await TripInvitation.create({
        trip: tripId,
        sender: userId,
        recipient: recipientId,
        requestType: "invite",
        message: message?.trim() || "",
      });

    await invitation.populate(invitationPopulate);

    const senderName = await getUserDisplayName(userId);

    await createTripNotification({
      recipientId,
      senderId: userId,
      tripId,
      type: "trip_invite",
      message: `${senderName} đã mời bạn tham gia chuyến đi ${trip.title}`,
    });

    return res.status(201).json({
      success: true,
      message: "Gửi lời mời thành công",
      invitation,
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(400).json({
        success: false,
        message:
          "Lời mời này đang chờ người nhận phản hồi",
      });
    }

    console.error("Lỗi gửi lời mời:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể gửi lời mời",
    });
  }
};

// Người dùng gửi yêu cầu tham gia chuyến đi công khai.
export const sendJoinRequest = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;
    const tripId = getParamValue(
      req.params.tripId
    );
    const { message } =
      req.body as SendJoinRequestBody;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập",
      });
    }

    if (!mongoose.isValidObjectId(tripId)) {
      return res.status(400).json({
        success: false,
        message: "Mã chuyến đi không hợp lệ",
      });
    }

    if (message && message.trim().length > 300) {
      return res.status(400).json({
        success: false,
        message:
          "Lời nhắn không được vượt quá 300 ký tự",
      });
    }

     const trip = await Trip.findOne({
      _id: tripId,
       isActive: true,
       visibility: "public",
       isLookingForCompanions: true,
       status: {
       $in: ["planning", "ongoing"],
       },
        });
    if (!trip) {
      return res.status(404).json({
        success: false,
        message:
          "Chuyến đi không tồn tại hoặc không còn nhận thành viên",
      });
    }

    if (trip.owner.toString() === userId) {
      return res.status(400).json({
        success: false,
        message:
          "Bạn là chủ chuyến đi nên không cần gửi yêu cầu",
      });
    }

    const isAlreadyMember = trip.members.some(
      (memberId) =>
        memberId.toString() === userId
    );

    if (isAlreadyMember) {
      return res.status(400).json({
        success: false,
        message:
          "Bạn đã là thành viên của chuyến đi",
      });
    }

    if (trip.members.length + 1 >= trip.maxMembers) {
      return res.status(400).json({
        success: false,
        message: "Chuyến đi đã đủ thành viên",
      });
    }

    const existingRequest =
      await TripInvitation.findOne({
        trip: tripId,
        sender: userId,
        requestType: "join_request",
        status: "pending",
      });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message:
          "Yêu cầu tham gia của bạn đang chờ phản hồi",
      });
    }

    const joinRequest =
      await TripInvitation.create({
        trip: tripId,
        sender: userId,
        recipient: trip.owner,
        requestType: "join_request",
        message: message?.trim() || "",
      });

    await joinRequest.populate(invitationPopulate);

    const senderName = await getUserDisplayName(userId);

    await createTripNotification({
      recipientId: trip.owner.toString(),
      senderId: userId,
      tripId,
      type: "trip_join_request",
      message: `${senderName} muốn tham gia chuyến đi ${trip.title}`,
    });

    return res.status(201).json({
      success: true,
      message:
        "Đã gửi yêu cầu tham gia đến chủ chuyến đi",
      invitation: joinRequest,
      requestStatus: "pending",
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(400).json({
        success: false,
        message:
          "Yêu cầu tham gia của bạn đang chờ phản hồi",
      });
    }

    console.error(
      "Lỗi gửi yêu cầu tham gia:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Không thể gửi yêu cầu tham gia",
    });
  }
};

// Kiểm tra trạng thái yêu cầu tham gia của người hiện tại.
export const getJoinRequestStatus = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;
    const tripId = getParamValue(
      req.params.tripId
    );

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập",
      });
    }

    if (!mongoose.isValidObjectId(tripId)) {
      return res.status(400).json({
        success: false,
        message: "Mã chuyến đi không hợp lệ",
      });
    }

    const trip = await Trip.findOne({
      _id: tripId,
      isActive: true,
    }).select("owner members");

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy chuyến đi",
      });
    }

    if (trip.owner.toString() === userId) {
      return res.status(200).json({
        success: true,
        requestStatus: "owner",
        invitationId: null,
      });
    }

    const isMember = trip.members.some(
      (memberId) =>
        memberId.toString() === userId
    );

    if (isMember) {
      return res.status(200).json({
        success: true,
        requestStatus: "member",
        invitationId: null,
      });
    }

    const request =
      await TripInvitation.findOne({
        trip: tripId,
        sender: userId,
        requestType: "join_request",
        status: "pending",
      }).select("_id status");

    return res.status(200).json({
      success: true,
      requestStatus: request
        ? "pending"
        : "none",
      invitationId: request?._id || null,
    });
  } catch (error) {
    console.error(
      "Lỗi kiểm tra yêu cầu tham gia:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Không thể kiểm tra yêu cầu tham gia",
    });
  }
};

// Người gửi tự hủy yêu cầu tham gia đang chờ.
export const cancelJoinRequest = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;
    const tripId = getParamValue(
      req.params.tripId
    );

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập",
      });
    }

    if (!mongoose.isValidObjectId(tripId)) {
      return res.status(400).json({
        success: false,
        message: "Mã chuyến đi không hợp lệ",
      });
    }

    const deletedRequest =
      await TripInvitation.findOneAndDelete({
        trip: tripId,
        sender: userId,
        requestType: "join_request",
        status: "pending",
      });

    if (!deletedRequest) {
      return res.status(404).json({
        success: false,
        message:
          "Không tìm thấy yêu cầu đang chờ",
      });
    }

    const trip = await Trip.findById(tripId).select(
      "title"
    );
    const senderName = await getUserDisplayName(userId);

    await createTripNotification({
      recipientId: deletedRequest.recipient.toString(),
      senderId: userId,
      tripId,
      type: "trip_join_cancelled",
      message: `${senderName} đã hủy yêu cầu tham gia chuyến đi ${trip?.title || ""}`.trim(),
    });

    return res.status(200).json({
      success: true,
      message: "Đã hủy yêu cầu tham gia",
      requestStatus: "none",
    });
  } catch (error) {
    console.error(
      "Lỗi hủy yêu cầu tham gia:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Không thể hủy yêu cầu tham gia",
    });
  }
};

// Lấy lời mời/yêu cầu mà tài khoản cần phản hồi.
export const getMyTripInvitations = async (
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

    const invitations =
      await TripInvitation.find({
        recipient: userId,
      })
        .populate(invitationPopulate)
        .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      invitations,
    });
  } catch (error) {
    console.error(
      "Lỗi lấy lời mời chuyến đi:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Không thể lấy danh sách lời mời",
    });
  }
};

// Người nhận đồng ý hoặc từ chối lời mời/yêu cầu.
export const respondToTripInvitation =
  async (
    req: AuthRequest,
    res: Response
  ) => {
    try {
      const userId = req.user?.userId;
      const invitationId = getParamValue(
        req.params.invitationId
      );
      const action = req.body.action as
        | "accept"
        | "reject"
        | undefined;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Bạn chưa đăng nhập",
        });
      }

      if (
        !mongoose.isValidObjectId(invitationId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Mã lời mời không hợp lệ",
        });
      }

      if (
        action !== "accept" &&
        action !== "reject"
      ) {
        return res.status(400).json({
          success: false,
          message: "Phản hồi không hợp lệ",
        });
      }

      const invitation =
        await TripInvitation.findOne({
          _id: invitationId,
          recipient: userId,
          status: "pending",
        });

      if (!invitation) {
        return res.status(404).json({
          success: false,
          message:
            "Không tìm thấy lời mời hoặc yêu cầu đã được xử lý",
        });
      }

      const isJoinRequest =
        invitation.requestType ===
        "join_request";

      const trip = await Trip.findOne({
        _id: invitation.trip,
        isActive: true,
      });

      if (!trip) {
        invitation.status = "rejected";
        await invitation.save();

        return res.status(404).json({
          success: false,
          message: "Chuyến đi không còn tồn tại",
        });
      }

      const responderName =
        await getUserDisplayName(userId);

      if (action === "reject") {
        invitation.status = "rejected";
        await invitation.save();

        await createTripNotification({
          recipientId: invitation.sender.toString(),
          senderId: userId,
          tripId: trip._id.toString(),
          type: isJoinRequest
            ? "trip_join_rejected"
            : "trip_invite_rejected",
          message: isJoinRequest
            ? `${responderName} đã từ chối yêu cầu tham gia chuyến đi ${trip.title}`
            : `${responderName} đã từ chối lời mời tham gia chuyến đi ${trip.title}`,
        });

        return res.status(200).json({
          success: true,
          message: isJoinRequest
            ? "Đã từ chối yêu cầu tham gia"
            : "Bạn đã từ chối lời mời",
          invitation,
        });
      }

      if (
        trip.members.length + 1 >=
        trip.maxMembers
      ) {
        return res.status(400).json({
          success: false,
          message: "Chuyến đi đã đủ thành viên",
        });
      }

      const memberId = isJoinRequest
        ? invitation.sender.toString()
        : invitation.recipient.toString();

      const isAlreadyMember = trip.members.some(
        (currentMemberId) =>
          currentMemberId.toString() === memberId
      );

      if (!isAlreadyMember) {
        trip.members.push(
          new mongoose.Types.ObjectId(memberId)
        );
        await trip.save();
      }

      invitation.status = "accepted";
      await invitation.save();

      await createTripNotification({
        recipientId: invitation.sender.toString(),
        senderId: userId,
        tripId: trip._id.toString(),
        type: isJoinRequest
          ? "trip_join_accepted"
          : "trip_invite_accepted",
        message: isJoinRequest
          ? `${responderName} đã chấp nhận yêu cầu tham gia chuyến đi ${trip.title}`
          : `${responderName} đã chấp nhận lời mời tham gia chuyến đi ${trip.title}`,
      });

      await invitation.populate(invitationPopulate);

      return res.status(200).json({
        success: true,
        message: isJoinRequest
          ? "Đã chấp nhận thành viên vào chuyến đi"
          : "Bạn đã tham gia chuyến đi thành công",
        invitation,
        tripId: trip._id,
      });
    } catch (error) {
      console.error(
        "Lỗi phản hồi lời mời/yêu cầu:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Không thể xử lý phản hồi",
      });
    }
  };

// Chủ chuyến đi hủy lời mời đã gửi.
export const cancelTripInvitation = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.userId;
    const invitationId = getParamValue(
      req.params.invitationId
    );

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn chưa đăng nhập",
      });
    }

    if (
      !mongoose.isValidObjectId(invitationId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Mã lời mời không hợp lệ",
      });
    }

    const invitation =
      await TripInvitation.findOneAndDelete({
        _id: invitationId,
        sender: userId,
        requestType: "invite",
        status: "pending",
      });

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message:
          "Không tìm thấy lời mời hoặc bạn không có quyền hủy",
      });
    }

    const trip = await Trip.findById(
      invitation.trip
    ).select("title");
    const senderName = await getUserDisplayName(userId);

    await createTripNotification({
      recipientId: invitation.recipient.toString(),
      senderId: userId,
      tripId: invitation.trip.toString(),
      type: "trip_invite_cancelled",
      message: `${senderName} đã hủy lời mời tham gia chuyến đi ${trip?.title || ""}`.trim(),
    });

    return res.status(200).json({
      success: true,
      message: "Đã hủy lời mời",
    });
  } catch (error) {
    console.error("Lỗi hủy lời mời:", error);

    return res.status(500).json({
      success: false,
      message: "Không thể hủy lời mời",
    });
  }
};

// Đếm lời mời/yêu cầu đang chờ tài khoản phản hồi.
export const getPendingInvitationCount =
  async (
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

      const pendingCount =
        await TripInvitation.countDocuments({
          recipient: userId,
          status: "pending",
        });

      return res.status(200).json({
        success: true,
        pendingCount,
      });
    } catch (error) {
      console.error(
        "Lỗi đếm lời mời/yêu cầu:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Không thể đếm lời mời chuyến đi",
      });
    }
  };