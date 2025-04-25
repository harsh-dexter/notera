// Define the types for the functions exposed via contextBridge
interface ElectronAPI {
  // Existing
  shareContent: (content: string) => void;

  // Recording functions
  getRecordingDevices: () => Promise<AudioDevice[]>;
  startRecording: (deviceId: string, deviceName: string) => void; // Expects ID and Name
  stopRecording: () => void; // Takes no args, returns void
  onRecordingStatus: (callback: (status: 'stopped' | 'error', message?: string) => void) => () => void; // Listener for stopped/error
  onRecordingStarted: (callback: (meetingId: string) => void) => () => void; // Listener for started + meetingId
}

// Use declare global to augment the existing Window interface
declare global {

  // Define the structure for audio devices returned by the main process
  // Use the exact casing returned by PowerShell (Name, ID)
  interface AudioDevice {
    Name: string; // Uppercase N
    ID: string;   // Uppercase ID
  }

  interface Window {
    electronAPI?: ElectronAPI; // Make it optional in case it's not running in Electron
  }
}

// Export {} to treat this file as a module, which can sometimes help with global declarations
export {};
