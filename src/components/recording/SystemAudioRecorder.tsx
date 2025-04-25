import React, { useState, useEffect } from 'react';
// No longer need useNavigate here, context handles it
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRecording } from '@/context/RecordingContext'; // Import the context hook

// The AudioDevice interface is now defined globally in src/types/electron.d.ts
// We use the global definition which expects Name and ID (uppercase)

export function SystemAudioRecorder() {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>(''); // Store device ID
  // Get recording state and functions from context
  const { isLiveRecording, startLiveRecording, recordingError } = useRecording();
  // Local state only for device loading and selection error
  const [isLoadingDevices, setIsLoadingDevices] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);


  // Fetch devices on mount
  useEffect(() => {
    const fetchDevices = async () => {
      setIsLoadingDevices(true);
      setFetchError(null); // Use local error state for fetch errors
      console.log('Recorder Component: Requesting recording devices...');
      try {
        // Check if running in Electron context
        if (window.electronAPI?.getRecordingDevices) {
          const fetchedDevices = await window.electronAPI.getRecordingDevices();
          console.log('Recorder Component: Received devices:', fetchedDevices);
          if (fetchedDevices && fetchedDevices.length > 0) {
             setDevices(fetchedDevices);
             // Optionally pre-select the first device or a specific one like Stereo Mix if found
              // setSelectedDevice(fetchedDevices[0].id);
           } else {
              setDevices([]);
              // setStatusMessage('No recording devices found.'); // Removed - status handled by context/error state
              console.warn('Recorder Component: No recording devices returned from main process.');
           }
         } else {
          console.error('Recorder Component: electronAPI or getRecordingDevices not available.');
          setFetchError('Recording features are not available in this environment.');
        }
      } catch (err: any) {
        console.error('Recorder Component: Error fetching recording devices:', err);
        setFetchError(`Error fetching devices: ${err.message || 'Unknown error'}`);
      } finally {
        setIsLoadingDevices(false);
      }
    };

    // Only fetch devices if running in Electron
    if (window.electronAPI) {
        fetchDevices();
    } else {
        setIsLoadingDevices(false);
        setFetchError('Recording features require the Electron app environment.');
    }
    // Listeners are now handled by the RecordingContext provider
  }, []); // Empty dependency array, only run on mount

  const handleDeviceChange = (value: string) => {
    console.log(`Recorder Component: Device selected: ${value}`);
    setSelectedDevice(value);
  };

  const handleStartRecording = () => {
    // Find the full device object based on the selected ID
    const device = devices.find(d => d.ID === selectedDevice);
    if (!device || isLiveRecording) return; // Check context state

    console.log(`Recorder Component: Calling startLiveRecording for device Name: ${device.Name} (ID: ${device.ID})`);
    // Call the context function to start recording
    startLiveRecording(device.ID, device.Name);
  };

  // Stop button is removed from here

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
       {/* Display fetch error or recording error from context */}
       {(fetchError || recordingError) && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{fetchError || recordingError}</span>
          </div>
        )}

      <p className="text-sm text-muted-foreground">
        Select the system audio output (e.g., Stereo Mix, What U Hear) to record.
        Ensure it's enabled in your Windows sound settings.
      </p>

      {isLoadingDevices ? (
        <p>Loading audio devices...</p>
      ) : devices.length > 0 ? (
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Select onValueChange={handleDeviceChange} value={selectedDevice} disabled={isLiveRecording}> {/* Disable based on context state */}
              <SelectTrigger className="w-full sm:w-[300px]">
                <SelectValue placeholder="Select Recording Device..." />
              </SelectTrigger>
                 <SelectContent>
                   {devices.map((device) => (
                     // Use uppercase Name and ID properties from the device object
                     <SelectItem key={device.ID} value={device.ID}>
                       {device.Name} {/* Display only Name for testing */}
                     </SelectItem>
                   ))}
              </SelectContent>
            </Select>

            {/* Only show Start button here */}
            <Button
              onClick={handleStartRecording}
              disabled={!selectedDevice || isLiveRecording} // Disable based on context state
            >
              Start Recording
            </Button>
          </div>
      ) : (
          <p className="text-orange-600">No recording devices found or accessible. Check permissions or install AudioDeviceCmdlets if prompted in logs.</p>
      )}

      {/* Status message can be simplified or removed if context handles errors */}
      {/* <p className="text-sm font-medium">Status: ... </p> */}
    </div>
  );
}
