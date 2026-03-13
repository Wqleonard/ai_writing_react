/**
 * Quick chat input channel types (aligned with Vue @/utils/interfaces)
 */
export interface QuickChatInputChannelValue {
  mold: "tip" | "span" | "input";
  value: string;
  width?: string;
}

export interface QuickChatInputChannel {
  title: string;
  icon?: string;
  value: QuickChatInputChannelValue[];
  disabled?: boolean;
}
