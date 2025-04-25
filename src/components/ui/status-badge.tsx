import { cn } from "@/lib/utils";

// Add the new processing and live recording states
type StatusType = "processing_asr" | "processing_analysis" | "completed" | "failed" | "recording_live";

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const statusConfig: Record<StatusType, { label: string; class: string }> = {
    processing_asr: { // Add config for processing_asr
      label: "Transcribing", // New label
      class: "bg-blue-100 text-blue-800 border-blue-200 animate-pulse-subtle", // Different color? Blue?
    },
    processing_analysis: { // Add config for processing_analysis
      label: "Analyzing", // New label
      class: "bg-amber-100 text-amber-800 border-amber-200 animate-pulse-subtle", // Keep amber for this?
    },
    completed: {
      label: "Completed",
      class: "bg-green-100 text-green-800 border-green-200",
    },
    failed: { // Changed key from "error" to "failed"
      label: "Failed",
      class: "bg-red-100 text-red-800 border-red-200",
    },
    recording_live: { // Add config for live recording
      label: "Recording",
      class: "bg-red-100 text-red-800 border-red-200 animate-pulse", // Use red and pulse
    },
  };

  // Provide a fallback configuration for unknown statuses
  const fallbackConfig = { 
    label: "Unknown", 
    class: "bg-gray-100 text-gray-800 border-gray-200" 
  };

  // Use the specific config if status is valid, otherwise use fallback
  const config = statusConfig[status] || fallbackConfig; 

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        config.class,
        className
      )}
    >
      {config.label}
    </span>
  );
}
