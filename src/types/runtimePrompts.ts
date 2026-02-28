/**
 * Runtime prompts types (aligned with Vue @/utils/interfaces)
 */
export type CueWordStage =
  | "brainwave_to_outline"
  | "outline_to_detailed"
  | "detailed_to_content";

export interface CueWord {
  stage: CueWordStage;
  category: string;
  content: string;
}

export interface RuntimePromptsFormData extends CueWord {
  selected: boolean;
  editStatus: boolean;
  id: string;
}
