import apiClient from "./index";

/**
 * 用户使用兑换码获取积分
 * POST /api/redemption-codes/redeem
 */
const redeemCodeReq = (code: string) => {
  return apiClient.post("/api/redemption-codes/redeem", { code });
};

export { redeemCodeReq };
