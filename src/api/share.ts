import apiClient from "./index";

export interface ShareItem {
  id: number;
  userId: number;
  username: string;
  userAvatarUrl: string;
  title: string;
  content: string;
  coverImageUrl: string;
  status: string;
  viewCount: number;
  likeCount: number;
  createdTime: string;
  updatedTime: string;
}

export interface ShareListResponse {
  totalElements: number;
  totalPages: number;
  size: number;
  content: ShareItem[];
  number: number;
  sort: {
    empty: boolean;
    unsorted: boolean;
    sorted: boolean;
  };
  pageable: {
    offset: number;
    sort: {
      empty: boolean;
      unsorted: boolean;
      sorted: boolean;
    };
    paged: boolean;
    unpaged: boolean;
    pageNumber: number;
    pageSize: number;
  };
  numberOfElements: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

const getShareList = (page: number = 0, size: number = 10) => {
  return apiClient.get<ShareListResponse>("/api/tweets", { page, size });
};

const getMyShareList = (page: number = 0, size: number = 10) => {
  return apiClient.get<ShareListResponse>("/api/tweets/my", { page, size });
};

export interface ShareDetailResponse {
  id: number;
  userId: number;
  username: string;
  userAvatarUrl: string;
  title: string;
  coverImageUrl: string;
  content: string;
  status: string;
  viewCount: number;
  likeCount: number;
  createdTime: string;
  updatedTime: string;
}

const getShareDetail = (id: string | number) => {
  return apiClient.get<ShareDetailResponse>(`/api/tweets/${id}`);
};

const createEmptyShare = () => {
  return apiClient.post("/api/tweets", {});
};

export interface SaveDraftRequest {
  title: string;
  coverImageUrl: string;
  content: string;
}

const saveDraft = (id: string | number, data: SaveDraftRequest) => {
  return apiClient.put<any>(`/api/tweets/${id}/draft`, data);
};

export interface PublishShareRequest {
  title: string;
  coverImageUrl: string;
  content: string;
}

const publishShare = (id: string | number, data: PublishShareRequest) => {
  return apiClient.put<any>(`/api/tweets/${id}/publish`, data);
};

const deleteShare = (id: string | number) => {
  return apiClient.del<any>(`/api/tweets/${id}`);
};

export {
  getShareList,
  getShareDetail,
  getMyShareList,
  createEmptyShare,
  saveDraft,
  publishShare,
  deleteShare,
};
