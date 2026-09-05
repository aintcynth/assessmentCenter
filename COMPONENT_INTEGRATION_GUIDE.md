/**
 * INTEGRATION GUIDE: Modal, Toast, and Loading Components
 * 
 * This file demonstrates how to use the success/error modals, toasts, and loading spinners
 * in your accreditation app.
 */

// ============================================
// 1. MODAL COMPONENT (useModal hook)
// ============================================
/*
Use modals for confirmation dialogs or error messages that require user acknowledgment.

Example usage:

import { useModal } from "@/lib/useModal";
import Modal from "@/components/Modal";

export default function MyPage() {
  const { modal, showSuccess, showError, closeModal } = useModal();

  const handleSuccess = () => {
    showSuccess(
      "Application Submitted",
      "Your application has been successfully submitted. You will receive updates via email.",
      "View Dashboard",
      () => router.push("/dashboard")
    );
  };

  const handleError = () => {
    showError(
      "Submission Failed",
      "Unable to upload document. Please check your connection and try again.",
      "Retry",
      handleSubmit
    );
  };

  return (
    <>
      <button onClick={handleSuccess}>Submit</button>
      <button onClick={handleError}>Simulate Error</button>
      
      <Modal
        isOpen={modal.isOpen}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        actionLabel={modal.actionLabel}
        onAction={modal.onAction}
        onClose={closeModal}
      />
    </>
  );
}
*/

// ============================================
// 2. TOAST COMPONENT (useToast hook)
// ============================================
/*
Use toasts for quick notifications that auto-dismiss (success/error messages).
They don't require user interaction and are less intrusive than modals.

Example usage:

import { useToast } from "@/lib/useToast";
import Toast from "@/components/Toast";

export default function MyPage() {
  const { toast, showSuccess, showError, closeToast } = useToast();

  const handleDocumentUpload = async (file) => {
    try {
      // ... upload logic ...
      showSuccess("Document uploaded successfully");
    } catch (error) {
      showError("Failed to upload document");
    }
  };

  return (
    <>
      <input 
        type="file" 
        onChange={(e) => handleDocumentUpload(e.target.files[0])}
      />
      
      <Toast
        isOpen={toast.isOpen}
        type={toast.type}
        message={toast.message}
        onClose={closeToast}
        duration={toast.duration}
      />
    </>
  );
}
*/

// ============================================
// 3. LOADING SPINNER COMPONENTS
// ============================================
/*
Use LoadingSpinner for inline loading states (e.g., within buttons, sections).
Use FullPageLoader for full-page loading (e.g., page initialization).

Example usage:

import { LoadingSpinner, FullPageLoader } from "@/components/LoadingSpinner";

// Inline spinner (in a form)
<button disabled={loading} className="btn-primary">
  {loading ? (
    <>
      <LoadingSpinner size="sm" message={null} />
      Uploading...
    </>
  ) : (
    "Upload Document"
  )}
</button>

// Full page loader
{pageLoading && <FullPageLoader message="Loading your application..." />}

// Spinner with custom size and message
<LoadingSpinner size="lg" message="Please wait..." />
<LoadingSpinner size="md" message="Uploading document..." />
<LoadingSpinner size="sm" message={null} />
*/

// ============================================
// 4. COMPLETE EXAMPLE
// ============================================
/*
Real-world example integrating all components:

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useModal } from "@/lib/useModal";
import { useToast } from "@/lib/useToast";
import Modal from "@/components/Modal";
import Toast from "@/components/Toast";
import { LoadingSpinner, FullPageLoader } from "@/components/LoadingSpinner";
import { createClient } from "@/lib/supabase/client";

export default function ApplicationForm() {
  const router = useRouter();
  const supabase = createClient();
  
  const { modal, showSuccess, showError, closeModal } = useModal();
  const { toast, showSuccess: toastSuccess, showError: toastError, closeToast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize page
  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        // Load data
      } catch (error) {
        showError("Failed to Load", error.message);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // Submit application
  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from("applications")
        .insert({ /* data */ });
      
      if (error) throw error;

      showSuccess(
        "Application Submitted",
        "Your application has been successfully submitted.",
        "View Details",
        () => router.push("/dashboard")
      );
    } catch (error) {
      showError(
        "Submission Failed",
        error.message,
        "Retry",
        handleSubmit
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Upload document (with toast)
  const handleUpload = async (file) => {
    try {
      // Upload logic
      toastSuccess("Document uploaded successfully");
    } catch (error) {
      toastError("Failed to upload document");
    }
  };

  if (isLoading) {
    return <FullPageLoader message="Loading application..." />;
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <input type="text" placeholder="Application details" />
        <button 
          type="submit" 
          disabled={isSaving}
          className="btn-primary"
        >
          {isSaving ? (
            <>
              <LoadingSpinner size="sm" message={null} />
              Submitting...
            </>
          ) : (
            "Submit Application"
          )}
        </button>
      </form>

      {/* Modal for success/error messages */}
      <Modal
        isOpen={modal.isOpen}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        actionLabel={modal.actionLabel}
        onAction={modal.onAction}
        onClose={closeModal}
      />

      {/* Toast for quick notifications */}
      <Toast
        isOpen={toast.isOpen}
        type={toast.type}
        message={toast.message}
        onClose={closeToast}
        duration={toast.duration}
      />
    </>
  );
}
*/

// ============================================
// API REFERENCE
// ============================================

/*
### useModal Hook

const { modal, showSuccess, showError, showInfo, closeModal } = useModal();

Methods:
- showSuccess(title, message, actionLabel?, onAction?)
- showError(title, message, actionLabel?, onAction?)
- showInfo(title, message, actionLabel?, onAction?)
- closeModal()

Properties:
- modal.isOpen: boolean
- modal.type: "success" | "error" | "info"
- modal.title: string
- modal.message: string
- modal.actionLabel: string
- modal.onAction: function | null

---

### useToast Hook

const { toast, showSuccess, showError, showInfo, closeToast } = useToast();

Methods:
- showSuccess(message, duration?) - default 4000ms
- showError(message, duration?) - default 5000ms
- showInfo(message, duration?) - default 4000ms
- closeToast()

Properties:
- toast.isOpen: boolean
- toast.type: "success" | "error" | "info"
- toast.message: string
- toast.duration: number

---

### LoadingSpinner Component

<LoadingSpinner size="sm|md|lg" message="Optional message" />

Props:
- size: "sm" | "md" | "lg" (default: "md")
- message: string (default: "Loading...")

---

### FullPageLoader Component

<FullPageLoader message="Optional message" />

Props:
- message: string (default: "Loading...")

---

### Modal Component

<Modal
  isOpen={boolean}
  type="success|error|info"
  title={string}
  message={string}
  actionLabel={string}
  onAction={function}
  onClose={function}
/>

Props:
- isOpen: boolean (required)
- type: "success" | "error" | "info" (default: "success")
- title: string (required)
- message: string (required)
- actionLabel: string (default: "Close")
- onAction: () => void (optional)
- onClose: () => void (required)

---

### Toast Component

<Toast
  isOpen={boolean}
  type="success|error|info"
  message={string}
  duration={number}
  onClose={function}
/>

Props:
- isOpen: boolean (required)
- type: "success" | "error" | "info" (default: "success")
- message: string (required)
- duration: number in ms (default: 4000)
- onClose: () => void (required)
*/

export default function IntegrationGuide() {
  return (
    <div className="space-y-4 p-8">
      <h1 className="text-2xl font-bold">Modal & Loading Components Integration Guide</h1>
      <p className="text-gray-600">See code comments above for detailed usage examples and API reference.</p>
    </div>
  );
}
