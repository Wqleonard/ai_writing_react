import apiClient from "./index";

export interface Order {
  id: number;
  orderId: string;
  model: string;
  orderType: string;
  function: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
  totalCost: number;
  status: string;
  metadata: string;
  createdTime: string;
}

export interface OrdersPageResponse {
  totalPages: number;
  totalElements: number;
  size: number;
  content: Order[];
}

export type OrderTypeFilter = "ALL" | "INCREASE" | "DECREASE";

interface GetOrderHistoryParams {
  page?: number;
  size?: number;
  orderType?: OrderTypeFilter;
}

const getOrderHistory = (params?: GetOrderHistoryParams): Promise<OrdersPageResponse> => {
  const queryParams: Record<string, number | string> = {
    page: params?.page ?? 0,
    size: params?.size ?? 20,
    orderType: params?.orderType ?? "ALL",
  };
  return apiClient.get<OrdersPageResponse>("/api/orders/history", queryParams);
};

export { getOrderHistory };
export type { GetOrderHistoryParams };
