import apiClient from "./index";

const getWorkRankReq = () => {
  return apiClient.get("/api/rank/work-rank");
};

const getKeywordsRankReq = () => {
  return apiClient.get("/api/rank/keywords-rank");
};

const getSocialRankReq = () => {
  return apiClient.get("/api/rank/social-rank");
};

export { getWorkRankReq, getKeywordsRankReq, getSocialRankReq };
