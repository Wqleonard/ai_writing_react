"use client";

import React from "react";
import { FileText, Image } from "lucide-react";
import type { FileItem } from "@/stores/chatStore";

export interface FileMessageDisplayProps {
  files: FileItem[];
  onFileClick?: (file: FileItem) => void;
}

const isImageFile = (type: string) => type.startsWith("image/");
const isPdfFile = (type: string) => type === "application/pdf";
const isWordFile = (type: string) =>
  type === "application/msword" ||
  type ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const isTextFile = (type: string) => type === "text/plain";

const getFileTypeText = (type: string) => {
  if (isImageFile(type)) return "图片";
  if (isPdfFile(type)) return "PDF";
  if (isWordFile(type)) return "Word";
  if (isTextFile(type)) return "文本";
  return "文件";
};

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
  return `${(size / (1024 * 1024)).toFixed(1)}MB`;
};

const FileMessageDisplay = ({ files, onFileClick }: FileMessageDisplayProps) => {
  return (
    <div className="flex flex-wrap flex-row justify-end gap-1 my-0.5">
      {files.map((file) => (
        <div
          key={file.id}
          role="button"
          tabIndex={0}
          className="flex items-center bg-[#f8f9fa] border border-[#e9ecef] rounded-md py-1 px-2 cursor-pointer transition-all min-w-[80px] max-w-[140px] hover:bg-[#e9ecef] hover:border-[#dee2e6] hover:-translate-y-px hover:shadow"
          onClick={() => onFileClick?.(file)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onFileClick?.(file);
            }
          }}
        >
          <div className="mr-1.5 text-sm shrink-0">
            {isImageFile(file.type) ? (
              <Image className="w-3.5 h-3.5 text-[#28a745]" />
            ) : (
              <FileText className="w-3.5 h-3.5 text-[#6c757d]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium text-[#212529] truncate mb-px">
              {file.originalName}
            </div>
            <div className="text-[9px] text-[#6c757d] truncate">
              {getFileTypeText(file.type)} {formatFileSize(file.size)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FileMessageDisplay;
