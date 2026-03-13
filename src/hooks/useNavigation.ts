import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

/**
 * 导航相关的 hook（React Router 版本）
 * 提供安全的路由跳转方法
 */
export function useNavigation() {
  const navigate = useNavigate();

  const navigateTo = useCallback(
    (to: string | { pathname: string; search?: string; hash?: string }): void => {
      if (typeof to === "string") {
        navigate(to);
      } else {
        navigate(to);
      }
    },
    [navigate]
  );

  const navigateToHome = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const navigateToLogin = useCallback(() => {
    navigate("/login");
  }, [navigate]);

  const navigateToWorkspace = useCallback(() => {
    navigate("/workspace");
  }, [navigate]);

  const navigateToLanding = useCallback(() => {
    navigate("/");
  }, [navigate]);

  return {
    navigateTo,
    navigateToHome,
    navigateToLogin,
    navigateToWorkspace,
    navigateToLanding,
  };
}
