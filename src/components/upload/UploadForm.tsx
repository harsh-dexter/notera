
import { useState, useRef, ChangeEvent, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Meeting } from "@/services/api"; // Keep Meeting type
import { useNavigate } from "react-router-dom";
import { useUpload } from "@/hooks/use-upload"; // Import the hook

interface UploadFormProps {
  onUploadComplete?: (meeting: Meeting) => void;
}

// UploadStatus type is now defined in the hook

export function UploadForm({ onUploadComplete }: UploadFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const {
    uploadStatus,
    errorMessage,
    uploadFile,
    resetUploadState,
  } = useUpload(); // Use the hook

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      resetUploadState(); // Reset hook state when a new file is selected
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    try {
      const meeting = await uploadFile(selectedFile); // Call hook's upload function

      // Success handling (navigation, callback) remains in the component
      if (onUploadComplete) {
        onUploadComplete(meeting);
      }

      // Navigate immediately after successful upload initiation
      navigate("/meetings");

    } catch (error) {
      // Error is already handled and logged by the hook,
      // errorMessage state is set by the hook.
      // No need to set component state here.
      console.error("UploadForm handleSubmit caught error:", error);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    resetUploadState(); // Reset hook state
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; // Reset file input visually
    }
  };

  const statusDisplay = {
    idle: null,
    uploading: (
      <div className="flex items-center space-x-2 text-sm text-primary"> {/* Use text-primary */}
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Uploading...</span>
      </div>
    ),
    success: (
      // Using text-green-600 directly as success isn't a standard theme color
      <div className="flex items-center space-x-2 text-sm text-green-600 dark:text-green-500"> 
        <CheckCircle2 className="h-4 w-4" />
        <span>Upload complete! Redirecting to meetings...</span>
      </div>
    ),
    error: (
      <div className="flex items-center space-x-2 text-sm text-destructive"> {/* Use text-destructive */}
        <AlertCircle className="h-4 w-4" />
        <span>{errorMessage || "An unknown error occurred"}</span>
      </div>
    ),
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-md mx-auto">
      <div className="space-y-4"> {/* Increased spacing */}
        <div 
          className="bg-secondary border border-border rounded-2xl p-6 text-center hover:bg-accent transition-colors cursor-pointer" 
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" /> {/* Use muted foreground */}
          <div className="text-lg font-semibold text-foreground">Upload Meeting Audio</div> {/* Use foreground, bolder */}
          <p className="text-sm text-muted-foreground mt-1"> {/* Use muted foreground */}
            {selectedFile ? selectedFile.name : "Click to select an audio file or drag and drop"}
          </p>
          <Input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploadStatus === "uploading"}
          />
        </div>
        
        {/* Removed Progress bar display */}
        {uploadStatus !== "idle" && (
          <div className="mt-4 space-y-2">
            {statusDisplay[uploadStatus]}
          </div>
        )}
      </div>

      <div className="flex space-x-3">
        <Button
          type="submit"
          disabled={!selectedFile || uploadStatus === "uploading" || uploadStatus === "success"}
          className="flex-1"
        >
          {uploadStatus === "uploading" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading
            </>
          ) : (
            "Upload Audio"
          )}
        </Button>
        {selectedFile && uploadStatus !== "uploading" && (
          <Button type="button" variant="outline" onClick={handleReset}>
            Reset
          </Button>
        )}
      </div>
    </form>
  );
}
