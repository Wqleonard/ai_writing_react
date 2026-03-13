import apiClient from "./index";

interface ApiTag {
  id: number;
  name: string;
  userId: number;
}

export interface CourseDetailsResponse {
  id: number;
  title: string;
  coverImageUrl: string;
  content: string;
  authorName: string;
  description: string;
  tags: ApiTag[];
  likeCount: number;
  readCount: number;
  updatedTime: string;
  createdTime: string;
  isDeleted: boolean;
  isPrivate: boolean;
  publishedTime: string;
  likeValue: number;
}

const getCourses = (page = 0, size = 10) => {
  return apiClient.get("/api/courses", { page, size });
};

const getCourseDetails = (courseId: string) => {
  return apiClient.get<CourseDetailsResponse>(`/api/courses/${courseId}`);
};

type LikeCourseType = "0" | "1" | "2";

const likeCourse = (courseId: string, type: LikeCourseType) => {
  return apiClient.post(`/api/courses/${courseId}/like`, type);
};

const dislikeCourse = (courseId: string) => {
  return apiClient.post(`/api/courses/${courseId}/dislike`);
};

export { getCourses, getCourseDetails, likeCourse, dislikeCourse };
