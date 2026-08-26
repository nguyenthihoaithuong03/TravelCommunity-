import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import axiosClient from "../api/axiosClient";

export interface Author {
  _id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
}

export interface TripMember {
  _id: string;
  fullName: string;
  avatarUrl?: string;
}

export interface TripData {
  _id: string;
  owner: TripMember;
  title: string;
  destination: string;
  description: string;
  startDate: string;
  endDate: string;
  budget: number;
  coverImageUrl: string;
  members: TripMember[];
  status:
    | "planning"
    | "ongoing"
    | "completed"
    | "cancelled";
  visibility: "private" | "public";
  isLookingForCompanions: boolean;
  maxMembers: number;
}

export type PostType =
  | "normal"
  | "companion_trip";

export interface PostData {
  _id: string;
  author: Author;
  content: string;
  imageUrls: string[];
  location: string;
  likes: string[];
  createdAt: string;
  updatedAt?: string;
  sharesCount: number;
  commentsCount: number;
  postType: PostType;
  trip: TripData | null;
}

interface CreatePostResponse {
  success: boolean;
  message: string;
  post: PostData;
}

interface CreatePostModalProps {
  onClose: () => void;
  onPostCreated: (post: PostData) => void;
}

function CreatePostModal({
  onClose,
  onPostCreated,
}: CreatePostModalProps) {
  const [content, setContent] = useState("");
  const [location, setLocation] = useState("");
  const [selectedImages, setSelectedImages] =
    useState<File[]>([]);
  const [previewUrls, setPreviewUrls] =
    useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [isPosting, setIsPosting] =
    useState(false);

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) =>
        URL.revokeObjectURL(url)
      );
    };
  }, [previewUrls]);

  const handleImageChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const newFiles = Array.from(
      event.target.files || []
    );

    if (newFiles.length === 0) {
      return;
    }

    const invalidFile = newFiles.find(
      (file) =>
        ![
          "image/jpeg",
          "image/png",
          "image/webp",
        ].includes(file.type)
    );

    if (invalidFile) {
      setMessage(
        "Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP"
      );
      event.target.value = "";
      return;
    }

    const oversizedFile = newFiles.find(
      (file) => file.size > 5 * 1024 * 1024
    );

    if (oversizedFile) {
      setMessage(
        "Mỗi ảnh không được vượt quá 5 MB"
      );
      event.target.value = "";
      return;
    }

    const combinedFiles = [
      ...selectedImages,
      ...newFiles,
    ];

    if (combinedFiles.length > 5) {
      setMessage("Chỉ được chọn tối đa 5 ảnh");
      event.target.value = "";
      return;
    }

    setSelectedImages(combinedFiles);

    setPreviewUrls((currentUrls) => [
      ...currentUrls,
      ...newFiles.map((file) =>
        URL.createObjectURL(file)
      ),
    ]);

    setMessage("");
    event.target.value = "";
  };

  const removeImage = (index: number) => {
    const previewUrl = previewUrls[index];

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedImages((images) =>
      images.filter(
        (_, position) => position !== index
      )
    );

    setPreviewUrls((urls) =>
      urls.filter(
        (_, position) => position !== index
      )
    );
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setMessage("");

    if (!content.trim()) {
      setMessage(
        "Bạn chưa nhập nội dung bài viết"
      );
      return;
    }

    const formData = new FormData();

    formData.append("content", content.trim());
    formData.append("location", location.trim());

    selectedImages.forEach((image) => {
      formData.append("images", image);
    });

    try {
      setIsPosting(true);

      const response =
        await axiosClient.post<CreatePostResponse>(
          "/posts",
          formData
        );

      onPostCreated(response.data.post);
      onClose();
    } catch (error: any) {
      setMessage(
        error.response?.data?.message ||
          "Không thể đăng bài viết"
      );
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div
      className="post-modal-overlay"
      onMouseDown={onClose}
    >
      <div
        className="post-modal"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div className="post-modal-header">
          <h2>Tạo bài viết</h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="postContent">
            Nội dung bài viết
          </label>

          <textarea
            id="postContent"
            value={content}
            onChange={(event) =>
              setContent(event.target.value)
            }
            placeholder="Chia sẻ trải nghiệm du lịch..."
            maxLength={2000}
            rows={6}
            autoFocus
          />

          <div className="post-character-count">
            {content.length}/2000
          </div>

          <label htmlFor="postLocation">
            Địa điểm
          </label>

          <input
            id="postLocation"
            type="text"
            value={location}
            onChange={(event) =>
              setLocation(event.target.value)
            }
            placeholder="Ví dụ: Đà Lạt, Lâm Đồng"
            maxLength={200}
          />

          <label>Hình ảnh</label>

          <label
            className="choose-post-images"
            htmlFor="postImages"
          >
            📷 Chọn ảnh từ máy
          </label>

          <input
            id="postImages"
            className="post-images-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleImageChange}
          />

          <small>
            Tối đa 5 ảnh, mỗi ảnh không quá 5 MB.
          </small>

          {previewUrls.length > 0 && (
            <div className="post-image-previews">
              {previewUrls.map((url, index) => (
                <div
                  className="post-image-preview"
                  key={url}
                >
                  <img
                    src={url}
                    alt={`Ảnh đã chọn ${index + 1}`}
                  />

                  <button
                    type="button"
                    onClick={() =>
                      removeImage(index)
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {message && (
            <div className="post-modal-message">
              {message}
            </div>
          )}

          <button
            className="submit-post-button"
            type="submit"
            disabled={
              isPosting || !content.trim()
            }
          >
            {isPosting
              ? "Đang tải ảnh và đăng bài..."
              : "Đăng bài"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default CreatePostModal;