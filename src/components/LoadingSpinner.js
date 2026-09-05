"use client";

export function LoadingSpinner({ size = "md", message = "Loading..." }) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-10 h-10",
    lg: "w-16 h-16",
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      {/* Spinner */}
      <div className={`relative ${sizeClasses[size]}`}>
        <div className="absolute inset-0 rounded-full border-3 border-mist"></div>
        <div className="absolute inset-0 rounded-full border-3 border-transparent border-t-seal border-r-seal animate-spin"></div>
      </div>

      {/* Message */}
      {message && <p className="text-sm text-ink/60 font-medium">{message}</p>}
    </div>
  );
}

export function FullPageLoader({ message = "Loading..." }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-50">
      <LoadingSpinner size="lg" message={message} />
    </div>
  );
}
