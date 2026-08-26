import multer from "multer";

const storage = multer.memoryStorage();

const imageFilter: multer.Options["fileFilter"] = (
  _req,
  file,
  callback
) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  if (!allowedTypes.includes(file.mimetype)) {
    callback(
      new Error(
        "Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP"
      )
    );
    return;
  }

  callback(null, true);
};

const uploadImage = multer({
  storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export default uploadImage;