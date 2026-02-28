import apiClient from "./index";

const getWritingStylesListReq = () => {
  return apiClient.get("/api/writing-styles");
};

const getWritingStyleByIdReq = (id: string) => {
  return apiClient.get(`/api/writing-styles/${id}`);
};

const updateWritingStyleReq = (id: string, data: { name: string; content: string }) => {
  return apiClient.put(`/api/writing-styles/${id}`, data);
};

const deleteWritingStylesListReq = (id: string) => {
  return apiClient.del(`/api/writing-styles/${id}`);
};

export {
  getWritingStylesListReq,
  getWritingStyleByIdReq,
  updateWritingStyleReq,
  deleteWritingStylesListReq,
};
