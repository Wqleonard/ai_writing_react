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

const getInspirationCardsReq = (inspiration: string) => {
  return apiClient.post<InspirationCardsResponse>(
    "/api/works/inspiration",
    inspiration ? { inspiration } : undefined,
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

export { getInspirationCardsReq, getInspirationCardsImageReq };