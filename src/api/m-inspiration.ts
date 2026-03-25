import apiClient from "./index";

export interface InspirationItem {
  inspirationTheme: string;
  referenceStyle: string;
}

export interface InspirationCardsResponse {
  inspirationWord: string;
  inspirations: InspirationItem[];
}

export interface InspirationImageItem extends InspirationItem {
  index: string;
  imageUrl: string;
  inspirationWord: string;
}

export interface InspirationDetailResponse {
  roleInfo: string;
  mainEvent: string;
  roleSetting: string;
  worldSetting: string;
}

const getInspirationCardsReq = (inspiration: string) => {
  return apiClient.post<InspirationCardsResponse>(
    "/api/works/inspiration",
    inspiration ? { inspiration } : '',
  );
};

const getInspirationCardsImageReq = (inspirationWord: string, inspirations: InspirationItem[]) => {
  return apiClient.post<InspirationImageItem[]>(
    "/api/works/inspiration-image",
    {
      inspirationWord: inspirationWord,
      inspirations: inspirations,
    },
  );
};

const getInspirationDetail = (inspirationWord: string, inspirationTheme: string) => {
  return apiClient.post<InspirationDetailResponse>(
    "/api/works/inspiration/detail",
    {
      inspirationWord: inspirationWord,
      inspirationTheme: inspirationTheme,
    },
  );
};

export { getInspirationCardsReq, getInspirationCardsImageReq, getInspirationDetail };