import { contextBridge, ipcRenderer } from 'electron';

// Re-define interface locally for preload script context
// Ensure this matches the definition in src/types/electron.d.ts
interface AudioDevice {
  Name: string;
  ID: string;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // --- Existing ---
  shareContent: (content: string) => ipcRenderer.send('share-content', content),

  // --- Recording ---
  getRecordingDevices: (): Promise<AudioDevice[]> => ipcRenderer.invoke('get-recording-devices'), // Uses global AudioDevice
  startRecording: (deviceId: string, deviceName: string) => ipcRenderer.send('start-recording', deviceId, deviceName), // Send both ID and Name
  stopRecording: () => ipcRenderer.send('stop-recording'),
  // Listener for general status updates (stopped, error)
  onRecordingStatus: (callback: (status: 'stopped' | 'error', message?: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: 'stopped' | 'error', message?: string) => callback(status, message);
    ipcRenderer.on('recording-status', listener);
    // Return a function to remove the listener
    return () => ipcRenderer.removeListener('recording-status', listener);
  },
  // Listener specifically for when recording starts (includes meetingId)
  onRecordingStarted: (callback: (meetingId: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, meetingId: string) => callback(meetingId);
    ipcRenderer.on('recording-started', listener);
    // Return a function to remove the listener
    return () => ipcRenderer.removeListener('recording-started', listener);
  }
});

// Optional: Log to confirm preload script is loaded
console.log('Preload script loaded.');
