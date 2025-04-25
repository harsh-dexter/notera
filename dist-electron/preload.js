"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // --- Existing ---
    shareContent: (content) => electron_1.ipcRenderer.send('share-content', content),
    // --- Recording ---
    getRecordingDevices: () => electron_1.ipcRenderer.invoke('get-recording-devices'), // Uses global AudioDevice
    startRecording: (deviceId, deviceName) => electron_1.ipcRenderer.send('start-recording', deviceId, deviceName), // Send both ID and Name
    stopRecording: () => electron_1.ipcRenderer.send('stop-recording'),
    // Listener for general status updates (stopped, error)
    onRecordingStatus: (callback) => {
        const listener = (_event, status, message) => callback(status, message);
        electron_1.ipcRenderer.on('recording-status', listener);
        // Return a function to remove the listener
        return () => electron_1.ipcRenderer.removeListener('recording-status', listener);
    },
    // Listener specifically for when recording starts (includes meetingId)
    onRecordingStarted: (callback) => {
        const listener = (_event, meetingId) => callback(meetingId);
        electron_1.ipcRenderer.on('recording-started', listener);
        // Return a function to remove the listener
        return () => electron_1.ipcRenderer.removeListener('recording-started', listener);
    }
});
// Optional: Log to confirm preload script is loaded
console.log('Preload script loaded.');
//# sourceMappingURL=preload.js.map