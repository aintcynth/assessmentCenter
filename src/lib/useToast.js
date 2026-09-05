import { useState, useCallback } from "react";

export function useToast() {
  const [toast, setToast] = useState({
    isOpen: false,
    type: "success",
    message: "",
  });

  const showSuccess = useCallback((message, duration = 4000) => {
    setToast({
      isOpen: true,
      type: "success",
      message,
      duration,
    });
  }, []);

  const showError = useCallback((message, duration = 5000) => {
    setToast({
      isOpen: true,
      type: "error",
      message,
      duration,
    });
  }, []);

  const showInfo = useCallback((message, duration = 4000) => {
    setToast({
      isOpen: true,
      type: "info",
      message,
      duration,
    });
  }, []);

  const closeToast = useCallback(() => {
    setToast((prev) => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  return {
    toast,
    showSuccess,
    showError,
    showInfo,
    closeToast,
  };
}
