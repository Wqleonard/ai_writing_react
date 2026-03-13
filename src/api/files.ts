import apiClient from "./index";

export interface FileItem {
  id: string;
  originalName: string;
  serverFileName: string;
  putFilePath: string;
  displayUrl: string;
  type: string;
  size: number;
  extension: string;
}

const getFileUploadPathReq = (fileName: string) => {
  return apiClient.get("/api/works/put-file-path", { fileName });
};

const getFilePathReq = (fileName: string) => {
  return apiClient.get("/api/works/get-file-path", { fileName });
};

export interface FileUploadPathResponse {
  fileName: string;
  putFilePath: string;
}

export interface FilePathResponse {
  code: number;
  message: string;
  data: string;
}

const uploadFileWithPreSignedUrl = async (url: string, file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(url, {
    method: "PUT",
    body: formData,
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response;
};

const uploadFileReq = async (file: File) => {
  const pathResponse = (await getFileUploadPathReq(file.name)) as FileUploadPathResponse;
  const uploadResult = await uploadFileWithPreSignedUrl(pathResponse.putFilePath, file);
  return {
    fileName: pathResponse.fileName,
    putFilePath: pathResponse.putFilePath,
    uploadResult,
  };
};

const validateFileType = (file: File): boolean => {
  const allowedTypes = [
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/bmp",
    "image/webp",
    "image/svg+xml",
  ];
  const allowedExtensions = [
    ".doc",
    ".docx",
    ".txt",
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".bmp",
    ".webp",
    ".svg",
  ];
  if (allowedTypes.includes(file.type)) return true;
  const fileName = file.name.toLowerCase();
  return allowedExtensions.some((ext) => fileName.endsWith(ext));
};

export interface HandleUploadFileOptions {
  onError?: (message: string) => void;
  maxSizeBytes?: number;
}

const handleUploadFile = async (
  fileCallback: (file: FileItem) => void,
  options: HandleUploadFileOptions = {}
) => {
  const { onError, maxSizeBytes = 50 * 1024 * 1024 } = options;
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".doc,.docx,.txt,.pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp,.svg";
  fileInput.style.display = "none";

  fileInput.addEventListener("change", async (event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    if (!validateFileType(file)) {
      onError?.("不支持的文件格式，请选择 doc、docx、txt、pdf 或图片文件");
      return;
    }
    if (file.size > maxSizeBytes) {
      onError?.("文件大小不能超过50MB");
      return;
    }

    try {
      const result = await uploadFileReq(file);
      const extension = file.name.split(".").pop() || "";
      const fileData: FileItem = {
        id: `file_${Date.now()}`,
        originalName: file.name,
        serverFileName: result.fileName,
        putFilePath: result.putFilePath,
        displayUrl: result.putFilePath,
        type: file.type,
        size: file.size,
        extension,
      };
      fileCallback(fileData);
    } catch {
      onError?.("文件上传失败，请重试");
    }
  });

  document.body.appendChild(fileInput);
  fileInput.click();
  document.body.removeChild(fileInput);
};

export {
  getFileUploadPathReq,
  getFilePathReq,
  uploadFileWithPreSignedUrl,
  uploadFileReq,
  validateFileType,
  handleUploadFile,
};
