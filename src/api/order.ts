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

export interface ProductSku {
  id: number;
  productId: number;
  price: number;
  currency: string;
  validDays: number;
  credits: number;
  dailyBonusCredits: number;
  maxCredits: number;
  createdTime: string;
  updatedTime: string;
}

export interface Product {
  id: number;
  name: string;
  type: string;
  status: string;
  description: string;
  createdTime: string;
  skus: ProductSku[];
}

export interface BillingOrderCreateResponse {
  billingNo: string;
  cashierUrl: string;
  status: "PENDING" | "PAID" | "CANCELLED" | "REFUNDED";
}

export interface BillingOrderListItem {
  id?: number | string;
  orderNo?: string;
  billingNo?: string;
  status?: string;
  amount?: number;
  currency?: string;
  payChannel?: string;
  createdTime?: string;
  paidTime?: string;
  skuId?: number;
  skuName?: string;
  skuPrice?: number;
  skuCurrency?: string;
  skuCredits?: number;
  skuDailyBonusCredits?: number;
  skuMaxCredits?: number;
  [key: string]: unknown;
}

export interface BillingOrdersPageResponse {
  totalPages?: number;
  totalElements?: number;
  size?: number;
  content: BillingOrderListItem[];
}

export interface BillingOrderDetail {
  billingNo: string;
  status: "PENDING" | "PAID" | "CANCELLED" | "REFUNDED" | string;
  amount: number;
  payUrl: string;
  payChannel: string;
  paidTime: string;
  skuId: number;
  skuName: string;
  skuPrice: number;
  skuCurrency: string;
  skuCredits: number;
  skuDailyBonusCredits: number;
  skuMaxCredits: number;
}

export type OrderTypeFilter = "ALL" | "INCREASE" | "DECREASE";

interface GetOrderHistoryParams {
  page?: number;
  size?: number;
  orderType?: OrderTypeFilter;
}

interface GetBillingOrdersParams {
  page?: number;
  size?: number;
}

const getOrderHistory = (params?: GetOrderHistoryParams): Promise<OrdersPageResponse> => {
  const queryParams: Record<string, number | string> = {
    page: params?.page ?? 0,
    size: params?.size ?? 20,
    orderType: params?.orderType ?? "ALL",
  };
  return apiClient.get<OrdersPageResponse>("/api/orders/history", queryParams);
};

const getProductsReq = (): Promise<Product[]> => {
  return apiClient.get<Product[]>("/api/products");
};

const createBillingOrderReq = (skuId: number): Promise<BillingOrderCreateResponse> => {
  return apiClient.post<BillingOrderCreateResponse>("/api/billing/orders", { skuId });
};

const getBillingOrdersReq = (params?: GetBillingOrdersParams): Promise<BillingOrdersPageResponse> => {
  const queryParams: Record<string, number> = {
    page: params?.page ?? 0,
    size: params?.size ?? 20,
  };
  return apiClient.get<BillingOrdersPageResponse>("/api/billing/orders", queryParams);
};

const getBillingOrderDetailReq = (orderNo: string): Promise<BillingOrderDetail> => {
  return apiClient.get<BillingOrderDetail>(`/api/billing/orders/${orderNo}`);
};

const cancelBillingOrderReq = (orderNo: string) => {
  return apiClient.post(`/api/billing/orders/${orderNo}/cancel`);
};

export {
  getOrderHistory,
  getProductsReq,
  createBillingOrderReq,
  getBillingOrdersReq,
  getBillingOrderDetailReq,
  cancelBillingOrderReq,
};
export type { GetOrderHistoryParams, GetBillingOrdersParams };
