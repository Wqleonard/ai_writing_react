"use client";

import React from "react";
import { FileText } from "lucide-react";
import type { SelectedText } from "@/stores/chatStore";

export interface SelectedTextDisplayProps {
  texts: SelectedText[];
}

const SelectedTextDisplay = ({ texts }: SelectedTextDisplayProps) => {
  return (
    <div className="flex flex-row justify-end flex-wrap gap-1 my-0.5">
      {texts.map((text) => (
        <div
          key={text.id}
          className="flex items-center bg-[#f8f9fa] border border-[#e9ecef] rounded-md py-1 px-2 min-w-[80px] max-w-[140px]"
        >
          <FileText className="w-3.5 h-3.5 text-[#6c757d] mr-1.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium text-[#212529] truncate">
              {text.content}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SelectedTextDisplay;
