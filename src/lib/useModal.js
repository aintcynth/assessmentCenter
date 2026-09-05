import { useState, useCallback } from "react";

export function useModal() {
  const [modal, setModal] = useState({
    isOpen: false,
    type: "success",
    title: "",
    message: "",
    actionLabel: "Continue",
  });

  const showSuccess = useCallback(
    (title, message, actionLabel = "Continue", onAction = null) => {
      setModal({
        isOpen: true,
        type: "success",
        title,
        message,
        actionLabel,
        onAction,
      });
    },
    []
  );

  const showError = useCallback(
    (title, message, actionLabel = "Retry", onAction = null) => {
      setModal({
        isOpen: true,
        type: "error",
        title,
        message,
        actionLabel,
        onAction,
      });
    },
    []
  );

  const showInfo = useCallback(
    (title, message, actionLabel = "Continue", onAction = null) => {
      setModal({
        isOpen: true,
        type: "info",
        title,
        message,
        actionLabel,
        onAction,
      });
    },
    []
  );

  const closeModal = useCallback(() => {
    setModal((prev) => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  return {
    modal,
    showSuccess,
    showError,
    showInfo,
    closeModal,
  };
}
