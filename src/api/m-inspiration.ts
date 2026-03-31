import apiClient from "./index";
import type { RequestConfig } from "./index";

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

const getInspirationCardsReq = (
  inspiration: string,
  config?: RequestConfig,
) => {
  return apiClient.post<InspirationCardsResponse>(
    "/api/works/inspiration",
    inspiration ? { inspiration } : "",
    config,
  );
};

const getInspirationCardsImageReq = (
  inspirationWord: string,
  inspirations: InspirationItem[],
  config?: RequestConfig,
) => {
  return apiClient.post<InspirationImageItem[]>(
    "/api/works/inspiration-image",
    {
      inspirationWord: inspirationWord,
      inspirations: inspirations,
    },
    config,
  );
};

const getInspirationDetail = (
  inspirationWord: string,
  inspirationTheme: string,
  config?: RequestConfig,
) => {
  return apiClient.post<InspirationDetailResponse>(
    "/api/works/inspiration/detail",
    {
      inspirationWord: inspirationWord,
      inspirationTheme: inspirationTheme,
    },
    config,
  );
};

export { getInspirationCardsReq, getInspirationCardsImageReq, getInspirationDetail };