"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron"); // Import clipboard and Notification
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
const node_fs_1 = __importDefault(require("node:fs"));
const electron_squirrel_startup_1 = __importDefault(require("electron-squirrel-startup"));
const node_fetch_1 = __importDefault(require("node-fetch")); // Added for backend calls
const form_data_1 = __importDefault(require("form-data")); // Added for sending files
// Backend base URL (should match backend config)
const BACKEND_BASE_URL = "http://localhost:7000";
// --- WAV Header Helper ---
function createWavHeader(dataLength, sampleRate, channels, bitsPerSample) {
    const buffer = Buffer.alloc(44);
    const byteRate = sampleRate * channels * (bitsPerSample / 8);
    const blockAlign = channels * (bitsPerSample / 8);
    // RIFF chunk descriptor
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataLength, 4); // ChunkSize
    buffer.write('WAVE', 8);
    // fmt sub-chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
    buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
    buffer.writeUInt16LE(channels, 22); // NumChannels
    buffer.writeUInt32LE(sampleRate, 24); // SampleRate
    buffer.writeUInt32LE(byteRate, 28); // ByteRate
    buffer.writeUInt16LE(blockAlign, 32); // BlockAlign
    buffer.writeUInt16LE(bitsPerSample, 34); // BitsPerSample
    // data sub-chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataLength, 40); // Subchunk2Size
    return buffer;
}
// --- Recording State Variables ---
let soxProcess = null;
let currentSessionPath = null;
let currentMeetingId = null; // Store the ID for the live meeting
let chunkCounter = 0;
const TEMP_RECORDING_DIR = node_path_1.default.join(electron_1.app.getAppPath(), 'temp_recording_chunks');
// Set the chunk duration in seconds
const chunkDurationInSeconds = 5;
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
    // --- Helper to send chunk to backend ---
    async function sendChunkToBackend(filePath, meetingId, chunkFileName, chunkIndex) {
        if (!meetingId) {
            console.error("Cannot send chunk: meetingId is not set.");
            return;
        }
        console.log(`Sending chunk ${chunkFileName} (index: ${chunkIndex}) for meeting ${meetingId} to backend...`);
        const formData = new form_data_1.default();
        try {
            const fileStream = node_fs_1.default.createReadStream(filePath);
            formData.append('file', fileStream, chunkFileName);
            formData.append('chunk_index', String(chunkIndex)); // Add chunk index as form data
            const response = await (0, node_fetch_1.default)(`${BACKEND_BASE_URL}/upload/transcribe-chunk/${meetingId}`, {
                method: 'POST',
                body: formData,
                headers: formData.getHeaders(), // Required for form-data
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Backend error sending chunk ${chunkFileName}: ${response.status} ${response.statusText}`, errorText);
                // Handle error appropriately (e.g., notify renderer)
            }
            else {
                const result = await response.json();
                console.log(`Backend response for chunk ${chunkFileName}:`, result);
                // Optionally delete the local chunk file after successful upload
                // fs.unlink(filePath, (err) => {
                //     if (err) console.error(`Error deleting chunk ${filePath}:`, err);
                // });
            }
        }
        catch (error) {
            console.error(`Error sending chunk ${chunkFileName} to backend:`, error);
            // Handle network or other errors
        }
    }
    // --- Helper function to call the backend finalization endpoint ---
    async function finalizeMeetingOnBackend(meetingId) {
        console.log(`Attempting to finalize meeting ${meetingId} on backend...`);
        try {
            const response = await (0, node_fetch_1.default)(`${BACKEND_BASE_URL}/meetings/${meetingId}/finalize-live`, {
                method: 'POST',
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Backend error finalizing meeting ${meetingId}: ${response.status} ${response.statusText}`, errorText);
            }
            else {
                const result = await response.json();
                console.log(`Backend response for finalizing meeting ${meetingId}:`, result);
            }
        }
        catch (error) {
            console.error(`Error calling finalize endpoint for meeting ${meetingId}:`, error);
        }
    }
    // --- Recording Functions ---
    async function startRecording(deviceName) {
        // Check if a SoX process is already running
        if (soxProcess) {
            console.warn('Recording is already in progress.');
            return;
        }
        console.log(`Attempting to start recording on device: ${deviceName}`);
        // 1. Create Live Meeting Record in Backend
        try {
            console.log("Creating live meeting record on backend...");
            const response = await (0, node_fetch_1.default)(`${BACKEND_BASE_URL}/meetings/create-live`, { method: 'POST' });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to create live meeting: ${response.status} ${errorText}`);
            }
            // Assert the type of the response data
            const newMeetingData = await response.json();
            currentMeetingId = newMeetingData.id; // Store the new meeting ID
            if (!currentMeetingId) {
                throw new Error("Backend did not return a valid meeting ID.");
            }
            console.log(`Backend created live meeting with ID: ${currentMeetingId}`);
        }
        catch (error) {
            console.error("Error creating live meeting record:", error);
            // Notify renderer of the failure
            electron_1.BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('recording-status', 'error', 'Failed to initiate live meeting');
            });
            return; // Stop if we can't create the meeting record
        }
        // 2. Create Local Session Directory
        const sessionTimestamp = Date.now();
        currentSessionPath = node_path_1.default.join(TEMP_RECORDING_DIR, `session_${sessionTimestamp}`);
        try {
            if (!node_fs_1.default.existsSync(TEMP_RECORDING_DIR)) {
                node_fs_1.default.mkdirSync(TEMP_RECORDING_DIR);
                console.log(`Created root temp directory: ${TEMP_RECORDING_DIR}`);
            }
            node_fs_1.default.mkdirSync(currentSessionPath);
            console.log(`Created session directory: ${currentSessionPath}`);
            chunkCounter = 0; // Reset chunk counter for the new session
        }
        catch (error) {
            console.error(`Failed to create recording directory: ${error}`);
            currentSessionPath = null; // Ensure path is null if creation failed
            // Notify renderer about the error?
            return;
        }
        // --- Use SoX via child_process ---
        const soxPath = "C:\\Program Files (x86)\\sox-14-4-2\\sox.exe"; // Assuming standard install path
        const sampleRate = 44100;
        const bitsPerSample = 16;
        const channels = 1; // MONO
        // Arguments for SoX:
        // -t waveaudio: Input type is Windows audio device
        // "{deviceName}": The ID of the device to capture (passed from renderer)
        // -t wav: Output type is WAV
        // -r {sampleRate}: Output sample rate
        // -c {channels}: Output channels (1 for mono)
        // -b {bitsPerSample}: Output bit depth
        // -: Output to stdout
        const soxArgs = [
            '-t', 'waveaudio', deviceName, // Use device ID directly
            '-t', 'wav',
            '-r', String(sampleRate),
            '-c', String(channels),
            '-b', String(bitsPerSample),
            '-' // Output to stdout
        ];
        console.log(`Spawning SoX: ${soxPath} ${soxArgs.join(' ')}`);
        try {
            soxProcess = (0, node_child_process_1.spawn)(soxPath, soxArgs);
            const audioInputStream = soxProcess.stdout; // Get audio data from SoX stdout
            // --- Stream Handling (same logic as before, but using audioInputStream from SoX) ---
            let chunkBuffer = Buffer.alloc(0);
            const chunkSizeInBytes = sampleRate * (bitsPerSample / 8) * channels * chunkDurationInSeconds;
            audioInputStream.on('data', (data) => {
                // The first 44 bytes from SoX WAV output might be the header, skip it?
                // Let's assume for now SoX pipes raw PCM data when outputting WAV to stdout ('-')
                // If chunks sound bad, we might need to inspect/skip the header here.
                chunkBuffer = Buffer.concat([chunkBuffer, data]);
                // Process full chunks
                while (chunkBuffer.length >= chunkSizeInBytes) {
                    const chunkToWrite = chunkBuffer.subarray(0, chunkSizeInBytes);
                    chunkBuffer = chunkBuffer.subarray(chunkSizeInBytes); // Keep the remainder
                    chunkCounter++;
                    const chunkFileName = `chunk-${String(chunkCounter).padStart(5, '0')}.wav`; // Save as WAV
                    const chunkFilePath = node_path_1.default.join(currentSessionPath, chunkFileName);
                    // Create WAV header for this chunk
                    // Parameters from micOptions: 44100 Hz, 1 channel (Mono), 16 bits
                    const header = createWavHeader(chunkToWrite.length, sampleRate, channels, bitsPerSample);
                    // Combine header and raw PCM data
                    const wavData = Buffer.concat([header, chunkToWrite]);
                    // Write the complete WAV chunk data
                    node_fs_1.default.writeFile(chunkFilePath, wavData, (writeErr) => {
                        if (writeErr) {
                            console.error(`Error writing WAV chunk ${chunkFileName}:`, writeErr);
                        }
                        else {
                            // console.log(`Saved WAV chunk: ${chunkFileName}`);
                            // After saving, send the chunk to the backend
                            if (currentMeetingId) {
                                // Pass the current chunkCounter as the chunkIndex
                                sendChunkToBackend(chunkFilePath, currentMeetingId, chunkFileName, chunkCounter);
                            }
                            else {
                                console.error("Cannot send chunk, currentMeetingId is null.");
                            }
                        }
                    });
                }
            });
            // Handle SoX process errors and exit
            soxProcess.stderr.on('data', (data) => {
                console.error(`SoX stderr: ${data}`);
                // Consider stopping recording and notifying renderer on significant errors
            });
            soxProcess.on('error', (err) => {
                console.error('Failed to start SoX process:', err);
                stopRecording(); // Stop if SoX fails to start
                // Notify renderer
                electron_1.BrowserWindow.getAllWindows().forEach(win => {
                    win.webContents.send('recording-status', 'error', 'Failed to start SoX');
                });
            });
            soxProcess.on('close', (code) => {
                console.log(`SoX process exited with code ${code}`);
                // If recording wasn't stopped manually, this indicates an unexpected exit
                if (soxProcess) { // Check if it wasn't already cleared by stopRecording
                    console.warn('SoX process closed unexpectedly.');
                    stopRecording(); // Ensure cleanup and notify renderer
                    electron_1.BrowserWindow.getAllWindows().forEach(win => {
                        win.webContents.send('recording-status', 'error', `SoX exited unexpectedly (code ${code})`);
                    });
                }
            });
            console.log('SoX process spawned, recording should start.');
            // Notify renderer that recording has started, including the meeting ID
            electron_1.BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('recording-started', currentMeetingId); // Send specific event with ID
            });
        }
        catch (error) {
            console.error(`Failed to spawn SoX process: ${error}`);
            soxProcess = null; // Ensure process handle is cleared
            currentSessionPath = null;
            // Notify renderer about the error?
            electron_1.BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('recording-status', 'error', 'Failed to start recording process');
            });
        }
    }
    function stopRecording() {
        if (!soxProcess) { // Check if SoX process exists
            console.warn('Recording is not currently in progress.');
            return;
        }
        console.log('Attempting to stop recording (killing SoX process)...');
        try {
            soxProcess.kill('SIGTERM'); // Send termination signal to SoX
            console.log('Sent SIGTERM to SoX process.');
            // Process any remaining data in the buffer? (For simplicity, we discard it for now)
            // Clean up state
            const stoppedSessionPath = currentSessionPath;
            const stoppedMeetingId = currentMeetingId; // Store ID before clearing
            soxProcess = null;
            currentSessionPath = null;
            chunkCounter = 0;
            currentMeetingId = null; // Clear the current meeting ID
            console.log(`Recording session saved in: ${stoppedSessionPath}`);
            // Call backend to finalize the meeting status
            if (stoppedMeetingId) {
                finalizeMeetingOnBackend(stoppedMeetingId); // Call helper function
            }
            else {
                console.error("Cannot finalize meeting: meeting ID was not available when recording stopped.");
            }
            // Notify renderer that recording has stopped
            electron_1.BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('recording-status', 'stopped');
            });
        }
        catch (error) {
            console.error(`Error stopping SoX process: ${error}`);
            // Force cleanup state even if stop fails
            soxProcess = null;
            currentSessionPath = null;
            chunkCounter = 0;
        }
    }
    // --- IPC Handlers for Recording Control ---
    electron_1.ipcMain.on('start-recording', (_event, deviceId, deviceName) => {
        if (!deviceId || !deviceName) {
            console.error('IPC: Start recording request received without device ID or name.');
            return;
        }
        console.log(`IPC: Received start recording request for device Name: ${deviceName} (ID: ${deviceId})`);
        // Pass the NAME to the startRecording function, as SoX seems to prefer it
        startRecording(deviceName);
    });
    electron_1.ipcMain.on('stop-recording', () => {
        console.log('IPC: Received stop recording request.');
        stopRecording();
    });
    // --- Function to get recording devices using PowerShell ---
    async function getRecordingDevices() {
        // Only run on Windows
        if (process.platform !== 'win32') {
            console.warn('Audio device listing is only supported on Windows.');
            return [];
        }
        const command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -Command \"Get-AudioDevice -List | Where-Object {$_.Type -eq 'Recording'} | Select-Object -Property Name, ID | ConvertTo-Json -Compress\"";
        return new Promise((resolve, reject) => {
            (0, node_child_process_1.exec)(command, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error executing PowerShell command: ${error.message}`);
                    console.error(`Stderr: ${stderr}`);
                    // Attempt to provide a more user-friendly error or fallback
                    if (stderr.includes("Get-AudioDevice") && stderr.includes("not recognized")) {
                        console.error("Get-AudioDevice cmdlet not found. Ensure the 'AudioDeviceCmdlets' module is installed: Install-Module -Name AudioDeviceCmdlets -Scope CurrentUser");
                        // Potentially return a specific error indicator or empty array
                        return reject(new Error("AudioDeviceCmdlets module not found. Please install it."));
                    }
                    return reject(error); // Reject with the original error for other issues
                }
                if (stderr) {
                    console.warn(`PowerShell stderr: ${stderr}`); // Log warnings but proceed if stdout is valid
                }
                console.log("Raw PowerShell stdout:", stdout); // Log raw output
                try {
                    // Trim stdout to remove potential trailing newlines before parsing
                    const trimmedStdout = stdout.trim();
                    if (!trimmedStdout) {
                        console.warn("PowerShell stdout is empty after trimming.");
                        return resolve([]); // Resolve with empty array if output is empty
                    }
                    const devices = JSON.parse(trimmedStdout);
                    console.log("Parsed devices:", JSON.stringify(devices, null, 2)); // Log parsed output
                    // Ensure it's an array, PowerShell might return single object if only one device
                    resolve(Array.isArray(devices) ? devices : [devices]);
                }
                catch (parseError) {
                    console.error(`Error parsing PowerShell output: ${parseError}`);
                    console.error(`Raw stdout: ${stdout}`); // Log raw output for debugging
                    reject(parseError);
                }
            });
        });
    }
    // --- IPC Handler for Getting Recording Devices ---
    electron_1.ipcMain.handle('get-recording-devices', async () => {
        console.log('IPC: Received request for recording devices.');
        try {
            const devices = await getRecordingDevices();
            console.log('IPC: Sending recording devices:', devices);
            return devices;
        }
        catch (error) {
            console.error('IPC: Error getting recording devices:', error);
            // Return an empty array or an error object to the renderer
            // Returning an empty array might be simpler for the frontend to handle
            return [];
            // Or: return { error: error.message || 'Failed to get devices' };
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
//# sourceMappingURL=main.js.map