import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface RecordingContextType {
  isLiveRecording: boolean;
  liveMeetingId: string | null;
  startLiveRecording: (deviceId: string, deviceName: string) => void;
  stopLiveRecording: () => void;
  recordingError: string | null;
}

const RecordingContext = createContext<RecordingContextType | undefined>(undefined);

export const useRecording = (): RecordingContextType => {
  const context = useContext(RecordingContext);
  if (!context) {
    throw new Error('useRecording must be used within a RecordingProvider');
  }
  return context;
};

interface RecordingProviderProps {
  children: ReactNode;
}

export const RecordingProvider: React.FC<RecordingProviderProps> = ({ children }) => {
  const [isLiveRecording, setIsLiveRecording] = useState<boolean>(false);
  const [liveMeetingId, setLiveMeetingId] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const navigate = useNavigate(); // Call navigate hook at top level

  // Listener setup effect
  useEffect(() => {
    let removeStartedListener: (() => void) | null = null;
    let removeStatusListener: (() => void) | null = null;

    if (window.electronAPI) {
      // Listener for when recording successfully starts
      removeStartedListener = window.electronAPI.onRecordingStarted((meetingId) => {
        console.log(`RecordingContext: Received recording started with meeting ID: ${meetingId}`);
        setLiveMeetingId(meetingId);
        setIsLiveRecording(true);
        setRecordingError(null);
        // Navigation happens here after state is set
        navigate(`/meetings/${meetingId}`); // Use navigate directly
      });

      // Listener for stop or error events
      removeStatusListener = window.electronAPI.onRecordingStatus((status, message) => {
        console.log(`RecordingContext: Received recording status update: ${status}`, message || '');
        setIsLiveRecording(false); // Stop recording on both events
        // Don't clear liveMeetingId on stop, page might still need it
        if (status === 'error') {
          setRecordingError(message || 'An unknown recording error occurred.');
        } else {
           setRecordingError(null); // Clear error on successful stop
        }
      });
    }

    // Cleanup listeners on unmount
    return () => {
      removeStartedListener?.();
      removeStatusListener?.();
    };
  }, [navigate]); // Add navigate back to dependency array

  const startLiveRecording = useCallback((deviceId: string, deviceName: string) => {
    if (isLiveRecording || !window.electronAPI) return;
    console.log("RecordingContext: Requesting start recording...");
    setRecordingError(null); // Clear previous errors
    // We don't set isLiveRecording=true here; we wait for the 'recording-started' event
    window.electronAPI.startRecording(deviceId, deviceName);
  }, [isLiveRecording]);

  const stopLiveRecording = useCallback(() => {
    if (!isLiveRecording || !window.electronAPI) return;
    console.log("RecordingContext: Requesting stop recording...");
    // We don't set isLiveRecording=false here; we wait for the 'recording-status' event
    window.electronAPI.stopRecording();
  }, [isLiveRecording]);

  const value = {
    isLiveRecording,
    liveMeetingId,
    startLiveRecording,
    stopLiveRecording,
    recordingError,
  };

  return (
    <RecordingContext.Provider value={value}>
      {children}
    </RecordingContext.Provider>
  );
};
