import multer from "multer";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/authRoutes.ts";
import userRoutes from "./routes/userRoutes.ts";
import postRoutes from "./routes/postRoutes.ts";
import commentRoutes from "./routes/commentRoutes.ts";
import notificationRoutes from "./routes/notificationRoutes.js";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { setSocketIO } from "./config/socket.js";
import tripRoutes from "./routes/tripRoutes.js";
import tripInvitationRoutes from "./routes/tripInvitationRoutes.js";
import favoriteDestinationRoutes from "./routes/favoriteDestinationRoutes.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  },
});

setSocketIO(io);

io.on("connection", (socket) => {
  console.log(
    `Frontend đã kết nối Socket.IO: ${socket.id}`
  );

  socket.on("join-user", (userId: string) => {
    if (!userId) {
      return;
    }

    socket.join(`user:${userId}`);

    console.log(
      `Người dùng ${userId} đã vào phòng thông báo`
    );
  });

  socket.on("disconnect", () => {
    console.log(
      `Frontend đã ngắt Socket.IO: ${socket.id}`
    );
  });
});
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/trip-invitations", tripInvitationRoutes);
// API kiểm tra Backend
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Travel Community API đang hoạt động",
  });
});
app.use(
  "/api/favorite-destinations",
  favoriteDestinationRoutes
);

// Hàm chờ trước khi kết nối lại MongoDB
const wait = (milliseconds: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
};

// Kết nối MongoDB
const connectMongoDB = async (): Promise<void> => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error(
      "Chưa khai báo MONGODB_URI trong file .env"
    );
  }

  let attempt = 1;

  while (true) {
    try {
      console.log(
        `Đang kết nối MongoDB - lần ${attempt}...`
      );

      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 10000,
        maxPoolSize: 10,
      });

      console.log("Kết nối MongoDB thành công");
      return;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Lỗi không xác định";

      console.error(
        `Kết nối MongoDB thất bại: ${message}`
      );
      console.log(
        "Hệ thống sẽ thử lại sau 5 giây..."
      );

      attempt += 1;
      await wait(5000);
    }
  }
};
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message:
            "Ảnh đại diện không được vượt quá 5 MB",
        });
      }

      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Đã xảy ra lỗi không xác định",
    });
  }
);

// Kết nối MongoDB rồi mới chạy Backend
const startServer = async (): Promise<void> => {
  try {
    await connectMongoDB();

    httpServer.listen(PORT, () => {
      console.log(
        `Backend đang chạy tại http://localhost:${PORT}`
      );
    });
  } catch (error) {
    console.error(
      "Không thể khởi động Backend:",
      error
    );
  }
};

startServer();