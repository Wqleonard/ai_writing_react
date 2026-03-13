import apiClient from "./index";
import type { NotesResponseData } from "./notes";

export interface NoteItem {
  id: number;
  userId: number;
  title: string;
  content: string;
  updatedTime: string;
  source: string;
}

export type { NotesResponseData };

const getMWorkspaceNotes = (page: number, size: number): Promise<NotesResponseData> => {
  return apiClient.get("/api/notes", { page, size });
};

export { getMWorkspaceNotes };
