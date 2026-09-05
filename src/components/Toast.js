"use client";

import { X, Check, AlertCircle, Info } from "lucide-react";
import { useEffect } from "react";

export default function Toast({ isOpen, type = "success", message, onClose, duration = 4000 }) {
  const isSuccess = type === "success";
  const isError = type === "error";
  const isInfo = type === "info";

  const bgColor = isSuccess ? "bg-green-50 border-green-200" : isError ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200";
  const textColor = isSuccess ? "text-green-800" : isError ? "text-red-800" : "text-blue-800";
  const iconColor = isSuccess ? "text-green-600" : isError ? "text-red-600" : "text-blue-600";
  const Icon = isSuccess ? Check : isError ? AlertCircle : Info;

  useEffect(() => {
    if (!isOpen || !duration) return;

    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
      <div className={`${bgColor} border rounded-lg shadow-lg p-4 flex items-center gap-3 min-w-64`}>
        <Icon className={`${iconColor} h-5 w-5 flex-shrink-0`} strokeWidth={2} />
        <p className={`${textColor} text-sm font-medium flex-1`}>{message}</p>
        <button
          onClick={onClose}
          className={`${textColor} hover:opacity-70 transition`}
          aria-label="Close toast"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
