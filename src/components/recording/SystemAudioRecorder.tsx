import React from 'react';
import { Button } from "@/components/ui/button";
import { useRecording } from '@/context/RecordingContext'; // Import the context hook

export function SystemAudioRecorder() {
  // Get recording state and functions from context
  const { isLiveRecording, startLiveRecording, recordingError } = useRecording();

  const handleStartRecording = () => {
    if (isLiveRecording) return; // Check context state
    console.log(`Recorder Component: Calling startLiveRecording`);
    // Call the context function to start recording
    startLiveRecording();
  };

  // Render nothing or an error message if not in Electron
  if (!window.electronAPI) {
     return (
        <div className="text-center text-muted-foreground p-4 border border-dashed rounded-md">
            System audio recording is only available in the desktop application environment.
        </div>
     );
  }

  return (
    <div className="space-y-4">
       {/* Display recording error from context */}
       {recordingError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{recordingError}</span>
          </div>
        )}

      <p className="text-sm text-muted-foreground">
        Click the button to start recording system audio and your default microphone.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        {/* Only show Start button here */}
        <Button
          onClick={handleStartRecording}
          disabled={isLiveRecording} // Disable based on context state
        >
          Start Recording
        </Button>
      </div>
    </div>
  );
}
