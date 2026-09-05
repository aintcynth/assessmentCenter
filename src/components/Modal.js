"use client";

import { X, Check, AlertCircle } from "lucide-react";

export default function Modal({ isOpen, type = "success", title, message, onClose, actionLabel = "Close", onAction }) {
  if (!isOpen) return null;

  const isSuccess = type === "success";
  const isError = type === "error";
  
  const iconBg = isSuccess ? "bg-green-100" : isError ? "bg-red-100" : "bg-blue-100";
  const iconColor = isSuccess ? "text-green-600" : isError ? "text-red-600" : "text-blue-600";
  const Icon = isSuccess ? Check : isError ? AlertCircle : AlertCircle;
  const accentColor = isSuccess ? "seal" : isError ? "red-600" : "blue-600";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white shadow-lg animate-fade-in">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-black/5 p-6">
            <div className="flex items-center gap-3">
              <div className={`${iconBg} rounded-full p-3`}>
                <Icon className={`${iconColor} h-6 w-6`} strokeWidth={2} />
              </div>
              <h2 className="text-lg font-semibold text-ink">{title}</h2>
            </div>
            <button
              onClick={onClose}
              className="text-ink/40 hover:text-ink transition"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6">
            <p className="text-sm text-ink/70 leading-relaxed">{message}</p>
          </div>

          {/* Footer */}
          <div className="flex gap-3 border-t border-black/5 p-6">
            <button
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Close
            </button>
            {onAction && (
              <button
                onClick={onAction}
                className="btn-primary flex-1"
              >
                {actionLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
