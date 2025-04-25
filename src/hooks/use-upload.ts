import { useState, useCallback } from "react";
import { api, Meeting } from "@/services/api";

type UploadStatus = "idle" | "uploading" | "success" | "error";

export function useUpload() {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const uploadFile = useCallback(async (file: File): Promise<Meeting> => {
    setUploadStatus("uploading");
    setErrorMessage(null);
    try {
      const meeting = await api.uploadMeeting(file);
      setUploadStatus("success");
      return meeting; // Return the meeting data on success
    } catch (error) {
      setUploadStatus("error");
      const message = (error instanceof Error) ? error.message : "Upload failed. Please try again.";
      setErrorMessage(message);
      console.error("Upload error:", error);
      throw error; // Re-throw the error so the caller can handle it if needed
    }
    // No finally block needed here as status is set in try/catch
  }, []); // No dependencies needed if api.uploadMeeting is stable

  const resetUploadState = useCallback(() => {
    setUploadStatus("idle");
    setErrorMessage(null);
  }, []);

  return {
    uploadStatus,
    errorMessage,
    uploadFile,
    resetUploadState,
  };
}
