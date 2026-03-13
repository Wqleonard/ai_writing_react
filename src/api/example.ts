import apiClient from "./index";

interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;
}

interface LoginParams {
  username: string;
  password: string;
}

interface LoginResponse {
  token: string;
  user: User;
}

export const userApi = {
  login: (params: LoginParams) => {
    return apiClient.post("/auth/login", params);
  },
  getUserInfo: (userId: number) => {
    return apiClient.get<User>(`/users/${userId}`);
  },
  updateUser: (userId: number, userData: Partial<User>) => {
    return apiClient.put<User>(`/users/${userId}`, userData);
  },
  deleteUser: (userId: number) => {
    return apiClient.del(`/users/${userId}`);
  },
  uploadAvatar: (file: File) => {
    return apiClient.upload<{ url: string }>("/users/avatar", file);
  },
};

export const articleApi = {
  create: (articleData: any) => {
    return apiClient.post("/articles", articleData);
  },
  getList: (params?: { page?: number; limit?: number; category?: string }) => {
    return apiClient.get("/articles", params);
  },
  getDetail: (articleId: number) => {
    return apiClient.get(`/articles/${articleId}`);
  },
  update: (articleId: number, articleData: any) => {
    return apiClient.put(`/articles/${articleId}`, articleData);
  },
  delete: (articleId: number) => {
    return apiClient.del(`/articles/${articleId}`);
  },
};

export const apiExamples = {
  async loginExample() {
    try {
      const result = await userApi.login({
        username: "test@example.com",
        password: "123456",
      });
      console.log("登录成功:", result);
      return result;
    } catch (error) {
      console.error("登录失败:", error);
      throw error;
    }
  },
  async getUserInfoExample() {
    try {
      const user = await userApi.getUserInfo(1);
      console.log("用户信息:", user);
      return user;
    } catch (error) {
      console.error("获取用户信息失败:", error);
      throw error;
    }
  },
  async createArticleExample() {
    try {
      const article = await articleApi.create({
        title: "测试文章",
        content: "这是测试内容",
        category: "技术",
      });
      console.log("文章创建成功:", article);
      return article;
    } catch (error) {
      console.error("创建文章失败:", error);
      throw error;
    }
  },
  async uploadFileExample(file: File) {
    try {
      const result = await userApi.uploadAvatar(file);
      console.log("文件上传成功:", result);
      return result;
    } catch (error) {
      console.error("文件上传失败:", error);
      throw error;
    }
  },
};
