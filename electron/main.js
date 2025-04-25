"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron"); // Import clipboard and Notification
const node_path_1 = __importDefault(require("node:path"));
const electron_squirrel_startup_1 = __importDefault(require("electron-squirrel-startup"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
const mic_1 = __importDefault(require("mic"));
const wav_1 = require("wav");
// Set AppUserModelID for Windows notifications and taskbar grouping
if (process.platform === 'win32') {
    electron_1.app.setAppUserModelId('com.company.fluentnotetakerai'); // Use a unique ID for your app
}
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (electron_squirrel_startup_1.default) {
    electron_1.app.quit();
}
const createWindow = () => {
    // Create the browser window.
    const mainWindow = new electron_1.BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: node_path_1.default.join(__dirname, 'preload.js'), // Load the preload script
            nodeIntegration: false, // Best practice for security
            contextIsolation: true, // Best practice for security
        },
    });
    // Load the index.html of the app.
    // In development, load from Vite dev server. In production, load from built files.
    if (process.env.NODE_ENV === 'development') {
        // TODO: Point this to your Vite dev server URL if you want hot-reloading during Electron dev
        // mainWindow.loadURL('http://localhost:5173'); // Default Vite port, adjust if needed
        // For now, we'll load the built file even in dev, requiring a frontend build first
        mainWindow.loadFile(node_path_1.default.join(__dirname, '../dist/index.html'));
        mainWindow.webContents.openDevTools(); // Open DevTools automatically in dev
    }
    else {
        mainWindow.loadFile(node_path_1.default.join(__dirname, '../dist/index.html'));
    }
};
// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
electron_1.app.whenReady().then(() => {
    createWindow();
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
// In this file, you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
// --- IPC Handler for Sharing ---
electron_1.ipcMain.on('share-content', (_event, content) => {
    console.log('Received content to share in main process.');
    if (!content) {
        console.error('No content received for sharing.');
        return;
    }
    // Platform-specific sharing logic
    if (process.platform === 'win32') {
        // Windows: Copy to clipboard and notify user
        electron_1.clipboard.writeText(content);
        console.log('Content copied to clipboard (Windows).');
        console.log(`Notification support check: ${electron_1.Notification.isSupported()}`);
        if (electron_1.Notification.isSupported()) {
            try {
                console.log('Attempting to create notification...');
                const notification = new electron_1.Notification({
                    title: 'Content Ready to Share',
                    body: 'Copied to clipboard. Press Win+H or use the Share charm/button to share.',
                    silent: true // Optional: prevent sound
                });
                notification.on('show', () => console.log('Notification shown successfully.'));
                notification.on('click', () => console.log('Notification clicked.'));
                notification.on('close', () => console.log('Notification closed.'));
                // Note: 'error' event might not fire for all issues on Windows.
                console.log('Attempting to show notification...');
                notification.show();
                console.log('Called notification.show()'); // Log that the call was made
            }
            catch (error) {
                console.error('Error creating or showing notification:', error);
            }
        }
        else {
            console.log('Notifications reported as not supported on this system.');
            // Optionally, show a dialog box as a fallback notification
            // dialog.showMessageBox({ type: 'info', title: 'Content Copied', message: 'Content copied to clipboard. Share manually.' });
        }
    }
    else if (process.platform === 'darwin') {
        // macOS: Placeholder - Use electron.shareItem (Electron 13+) or external lib
        console.log('macOS sharing not implemented yet. Content:', content);
        // Example using shareItem (requires Electron 13+):
        // if (app.isReady()) { // Ensure app is ready
        //   shareItem({ items: [content] }); // shareItem is async but doesn't return promise
        // }
        // Fallback: Copy to clipboard
        electron_1.clipboard.writeText(content);
        console.log(`Notification support check (macOS): ${electron_1.Notification.isSupported()}`);
        if (electron_1.Notification.isSupported()) {
            try {
                const notification = new electron_1.Notification({ title: 'Content Copied', body: 'Sharing not implemented, content copied to clipboard.' });
                notification.on('show', () => console.log('Notification shown successfully (macOS).'));
                notification.show();
            }
            catch (error) {
                console.error('Error creating or showing notification (macOS):', error);
            }
        }
        else {
            console.log('Notifications reported as not supported on this system (macOS).');
        }
    }
    else {
        // Linux/Other: Placeholder - Use xdg-share or similar
        console.log('Linux/Other platform sharing not implemented yet. Content:', content);
        // Fallback: Copy to clipboard
        electron_1.clipboard.writeText(content);
        console.log(`Notification support check (Other): ${electron_1.Notification.isSupported()}`);
        if (electron_1.Notification.isSupported()) {
            try {
                const notification = new electron_1.Notification({ title: 'Content Copied', body: 'Sharing not implemented, content copied to clipboard.' });
                notification.on('show', () => console.log('Notification shown successfully (Other).'));
                notification.show();
            }
            catch (error) {
                console.error('Error creating or showing notification (Other):', error);
            }
        }
        else {
            console.log('Notifications reported as not supported on this system (Other).');
        }
    }
});
// --- IPC Handlers for Audio Recording ---
let micInstance = null;
let micInputStream = null;
let wavFileWriter = null;
let currentChunkIndex = 0;
let chunkInterval = null;
let tempAudioDir = node_path_1.default.join(node_os_1.default.tmpdir(), 'fluent-note-taker-audio-chunks');
let recordedChunks = [];
// Create the temporary audio directory if it doesn't exist
if (!node_fs_1.default.existsSync(tempAudioDir)) {
    node_fs_1.default.mkdirSync(tempAudioDir, { recursive: true });
}
electron_1.ipcMain.handle('start-record', async () => {
    try {
        // Clear previous recordings
        recordedChunks = [];
        currentChunkIndex = 0;
        // Create or empty the temp directory
        if (node_fs_1.default.existsSync(tempAudioDir)) {
            // Clean up previous files
            const files = node_fs_1.default.readdirSync(tempAudioDir);
            for (const file of files) {
                node_fs_1.default.unlinkSync(node_path_1.default.join(tempAudioDir, file));
            }
        }
        else {
            node_fs_1.default.mkdirSync(tempAudioDir, { recursive: true });
        }
        // Configure mic
        micInstance = (0, mic_1.default)({
            rate: '16000',
            channels: '1',
            fileType: 'raw',
            // Try to use Stereo Mix if available, otherwise use default
            device: 'Stereo Mix',
            // Add some buffer to handle delays
            threshold: 0,
            silence: '0.0',
            debug: false
        });
        micInputStream = micInstance.getAudioStream();
        startNewChunk();
        // Start recording
        micInstance.start();
        // Set up interval for chunks (1 second)
        chunkInterval = setInterval(() => {
            // Close the current chunk and start a new one
            if (wavFileWriter) {
                wavFileWriter.end();
                startNewChunk();
            }
        }, 1000); // 1 second intervals
        return { success: true, message: 'Recording started' };
    }
    catch (error) {
        console.error('Error starting recording:', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('stop-record', async () => {
    try {
        // Stop the interval
        if (chunkInterval) {
            clearInterval(chunkInterval);
            chunkInterval = null;
        }
        // Stop the microphone
        if (micInstance) {
            micInstance.stop();
            micInstance = null;
        }
        // Close the current WAV file writer
        if (wavFileWriter) {
            wavFileWriter.end();
            wavFileWriter = null;
        }
        // Close the input stream
        if (micInputStream) {
            micInputStream.removeAllListeners();
            micInputStream = null;
        }
        // Return the list of recorded chunks
        return {
            success: true,
            chunks: recordedChunks,
            directory: tempAudioDir
        };
    }
    catch (error) {
        console.error('Error stopping recording:', error);
        return { success: false, error: error.message };
    }
});
// Helper function to start a new chunk
function startNewChunk() {
    const chunkFilename = `chunk-${currentChunkIndex}.wav`;
    const chunkPath = node_path_1.default.join(tempAudioDir, chunkFilename);
    // Add to our list of chunks
    recordedChunks.push(chunkPath);
    // Create new WAV file writer
    wavFileWriter = new wav_1.FileWriter(chunkPath, {
        channels: 1,
        sampleRate: 16000,
        bitDepth: 16
    });
    // Pipe the mic input stream to the WAV file writer
    if (micInputStream) {
        micInputStream.pipe(wavFileWriter);
        // Handle errors
        micInputStream.on('error', (err) => {
            console.error(`Error in microphone input stream: ${err}`);
        });
    }
    currentChunkIndex++;
}
//# sourceMappingURL=main.js.map