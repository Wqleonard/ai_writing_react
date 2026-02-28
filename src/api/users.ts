import apiClient from "./index";

interface RegisterInfo {
  phone: string | number;
  password: string;
  nickName?: string;
  invitationCode: string;
}

interface LoginInfo {
  phone: string | number;
  password: string;
}

const createNewUserReq = (registerInfo: RegisterInfo) => {
  return apiClient.post("/api/users/register", {
    phone: registerInfo.phone,
    password: registerInfo.password,
    invitationCode: registerInfo.invitationCode,
    nickName: registerInfo.nickName ? registerInfo.nickName : undefined,
  });
};

const loginReq = (loginInfo: LoginInfo) => {
  return apiClient.post("/api/users/login", {
    phone: loginInfo.phone,
    password: loginInfo.password,
  });
};

const postSuggestsReq = (suggest: string, contactNumber?: string) => {
  return apiClient.post("/api/users/suggests", {
    content: suggest,
    contactNumber: contactNumber ? contactNumber : undefined,
  });
};

const getUserInfoReq = () => {
  return apiClient.get("/api/users");
};

const getUserBalanceReq = () => {
  return apiClient.get("/api/users/balance");
};

const getInvitationCodeReq = () => {
  return apiClient.get("/api/users/invitation-code");
};

const useInvitationCodeReq = (invitationCode: string) => {
  return apiClient.post("/api/users/invitation-code", {
    invitationCode,
  });
};

const getFrozenUserEmailReq = () => {
  return apiClient.get("/api/users/is-have-frozen-user-email");
};

const postFrozenUserEmailReq = (email: string) => {
  return apiClient.post("/api/users/frozen-user-email", {
    email,
  });
};

interface UserInfo {
  nickName: string;
  coverImgUrl: string;
}

const updateUserInfo = (data: Partial<UserInfo>) => {
  return apiClient.put("/api/users", data);
};

const updatePassword = (oldPassword: string, newPassword: string) => {
  return apiClient.put("/api/users/password", {
    oldPassword,
    newPassword,
  });
};

const verifyTicket = (ticket: string, invitationCode: string = "") => {
  return apiClient.post("/api/users/verify-ticket", {
    ticket,
    invitationCode,
  });
};

export {
  getUserBalanceReq,
  createNewUserReq,
  useInvitationCodeReq,
  loginReq,
  postSuggestsReq,
  getUserInfoReq,
  getInvitationCodeReq,
  updateUserInfo,
  updatePassword,
  verifyTicket,
  postFrozenUserEmailReq,
  getFrozenUserEmailReq,
};
