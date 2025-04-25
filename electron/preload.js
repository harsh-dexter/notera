"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // Define a function 'shareContent' that the renderer can call
    shareContent: (content) => electron_1.ipcRenderer.send('share-content', content),
    // Audio recording API endpoints
    startRecording: () => electron_1.ipcRenderer.invoke('start-record'),
    stopRecording: () => electron_1.ipcRenderer.invoke('stop-record'),
    // You can add other APIs here as needed
});
// Optional: Log to confirm preload script is loaded
console.log('Preload script loaded.');
//# sourceMappingURL=preload.js.map