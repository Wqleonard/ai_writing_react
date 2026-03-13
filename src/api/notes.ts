import apiClient from "./index";

export type NoteSourceType =
  | "MINI_APP_ADD"
  | "MINI_APP_CHAT"
  | "MINI_APP_INSPIRATION"
  | "PC_ADD"
  | "PC_NOVEL_DECONSTRUCT"
  | "PC_CHAT_MODE"
  | "PC_INSPIRATION_DRAW"
  | "PC_WORD_HIGHLIGHT";

export interface Note {
  id: number;
  userId: number;
  title?: string;
  content: string;
  updatedTime: string;
  createdTime?: string;
  source?: NoteSourceType | string;
  isDeleted?: boolean;
}

export interface NotesPageResponse {
  totalPages: number;
  totalElements: number;
  size: number;
  content: Note[];
  number: number;
  sort: {
    empty: boolean;
    sorted: boolean;
    unsorted: boolean;
  };
  pageable: {
    offset: number;
    sort: {
      empty: boolean;
      sorted: boolean;
      unsorted: boolean;
    };
    unpaged: boolean;
    paged: boolean;
    pageNumber: number;
    pageSize: number;
  };
  numberOfElements: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

const addNote = (title: string, content: string, source: NoteSourceType) => {
  return apiClient.post("/api/notes", {
    title,
    content,
    source,
  });
};

const getNote = (id: string): Promise<Note> => {
  return apiClient.get<Note>(`/api/notes/${id}`);
};

const updateNote = (id: string, content: string, title: string) => {
  return apiClient.put(`/api/notes/${id}`, {
    content,
    title,
  });
};

const deleteNote = (id: string) => {
  return apiClient.del(`/api/notes/${id}`);
};

const getDailyRank = () => {
  return apiClient.get("/api/rank/keywords-rank");
};

interface GetNotesParams {
  page?: number;
  size?: number;
  sortBy?: string;
  sortDirection?: string;
}

interface SearchNotesParams {
  page?: number;
  size?: number;
  keyword: string;
}

const getNotes = (params?: GetNotesParams): Promise<NotesPageResponse> => {
  const queryParams: Record<string, unknown> = {
    page: params?.page ?? 0,
    size: params?.size ?? 20,
    sortBy: params?.sortBy ?? "updatedTime",
    sortDirection: params?.sortDirection ?? "desc",
  };
  return apiClient.get<NotesPageResponse>("/api/notes", queryParams);
};

const searchNotes = (params: SearchNotesParams): Promise<NotesPageResponse> => {
  const queryParams: Record<string, unknown> = {
    page: params.page ?? 0,
    size: params.size ?? 20,
    keyword: params.keyword,
  };
  return apiClient.get<NotesPageResponse>("/api/notes/search", queryParams);
};

export type NotesResponseData = NotesPageResponse;
export { addNote, getNote, updateNote, deleteNote, getDailyRank, getNotes, searchNotes };
export type { GetNotesParams, SearchNotesParams };
