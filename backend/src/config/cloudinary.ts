import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";

dotenv.config();

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  throw new Error(
    "Chưa cấu hình đầy đủ CLOUDINARY_CLOUD_NAME, " +
      "CLOUDINARY_API_KEY và CLOUDINARY_API_SECRET trong file .env"
  );
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

export default cloudinary;