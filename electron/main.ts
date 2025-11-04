import { app, BrowserWindow, ipcMain, clipboard, Notification } from 'electron'; // Import clipboard and Notification
import path from 'node:path';
import { exec, spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import { Writable } from 'node:stream';
import electronSquirrelStartup from 'electron-squirrel-startup';
import fetch from 'node-fetch'; // Added for backend calls
import FormData from 'form-data'; // Added for sending files

// Backend base URL (should match backend config)
const BACKEND_BASE_URL = "http://localhost:7000";

// --- Recording State Variables ---
let recorderProcess: ChildProcessWithoutNullStreams | null = null;
let currentSessionPath: string | null = null;
let currentMeetingId: string | null = null; // Store the ID for the live meeting
let chunkCounter = 0;
const TEMP_RECORDING_DIR = path.join(app.getAppPath(), 'temp_recording_chunks');


// Set AppUserModelID for Windows notifications and taskbar grouping
if (process.platform === 'win32') {
  app.setAppUserModelId('com.company.fluentnotetakerai'); // Use a unique ID for your app
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (electronSquirrelStartup) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Load the preload script
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
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    mainWindow.webContents.openDevTools(); // Open DevTools automatically in dev
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
  }
});


// --- Helper to send chunk to backend ---
async function sendChunkToBackend(filePath: string, meetingId: string, chunkFileName: string, chunkIndex: number) { // Add chunkIndex
    if (!meetingId) {
        console.error("Cannot send chunk: meetingId is not set.");
        return;
    }
    console.log(`Sending chunk ${chunkFileName} (index: ${chunkIndex}) for meeting ${meetingId} to backend...`);
    const formData = new FormData();
    try {
        const fileStream = fs.createReadStream(filePath);
        formData.append('file', fileStream, chunkFileName);
        formData.append('chunk_index', String(chunkIndex)); // Add chunk index as form data

        const response = await fetch(`${BACKEND_BASE_URL}/upload/transcribe-chunk/${meetingId}`, {
            method: 'POST',
            body: formData,
            headers: formData.getHeaders(), // Required for form-data
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Backend error sending chunk ${chunkFileName}: ${response.status} ${response.statusText}`, errorText);
            // Handle error appropriately (e.g., notify renderer)
        } else {
            const result = await response.json();
            console.log(`Backend response for chunk ${chunkFileName}:`, result);
            // Optionally delete the local chunk file after successful upload
            // fs.unlink(filePath, (err) => {
            //     if (err) console.error(`Error deleting chunk ${filePath}:`, err);
            // });
        }
    } catch (error) {
        console.error(`Error sending chunk ${chunkFileName} to backend:`, error);
        // Handle network or other errors
    }
}


// --- Helper function to call the backend finalization endpoint ---
async function finalizeMeetingOnBackend(meetingId: string) {
    console.log(`Attempting to finalize meeting ${meetingId} on backend...`);
    try {
        const response = await fetch(`${BACKEND_BASE_URL}/meetings/${meetingId}/finalize-live`, {
            method: 'POST',
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Backend error finalizing meeting ${meetingId}: ${response.status} ${response.statusText}`, errorText);
        } else {
            const result = await response.json();
            console.log(`Backend response for finalizing meeting ${meetingId}:`, result);
        }
    } catch (error) {
        console.error(`Error calling finalize endpoint for meeting ${meetingId}:`, error);
    }
}


// --- Recording Functions ---

async function startRecording() { // No longer needs deviceName
  // Check if a recorder process is already running
  if (recorderProcess) {
    console.warn('Recording is already in progress.');
    return;
  }

  console.log(`Attempting to start recording...`);

  // 1. Create Live Meeting Record in Backend
  try {
      console.log("Creating live meeting record on backend...");
      const response = await fetch(`${BACKEND_BASE_URL}/meetings/create-live`, { method: 'POST' });
      if (!response.ok) {
          const errorText = await response.text();
           throw new Error(`Failed to create live meeting: ${response.status} ${errorText}`);
       }
       // Assert the type of the response data
       const newMeetingData = await response.json() as { id: string; [key: string]: any };
       currentMeetingId = newMeetingData.id; // Store the new meeting ID
       if (!currentMeetingId) {
           throw new Error("Backend did not return a valid meeting ID.");
      }
      console.log(`Backend created live meeting with ID: ${currentMeetingId}`);
  } catch (error) {
      console.error("Error creating live meeting record:", error);
      // Notify renderer of the failure
      BrowserWindow.getAllWindows().forEach(win => {
         win.webContents.send('recording-status', 'error', 'Failed to initiate live meeting');
      });
      return; // Stop if we can't create the meeting record
  }


  // 2. Create Local Session Directory
  const sessionTimestamp = Date.now();
  currentSessionPath = path.join(TEMP_RECORDING_DIR, `session_${sessionTimestamp}`);
  try {
    if (!fs.existsSync(TEMP_RECORDING_DIR)) {
      fs.mkdirSync(TEMP_RECORDING_DIR);
      console.log(`Created root temp directory: ${TEMP_RECORDING_DIR}`);
    }
    fs.mkdirSync(currentSessionPath);
    console.log(`Created session directory: ${currentSessionPath}`);
    chunkCounter = 0; // Reset chunk counter for the new session
  } catch (error) {
    console.error(`Failed to create recording directory: ${error}`);
    currentSessionPath = null; // Ensure path is null if creation failed
    // Notify renderer about the error?
    return;
  }

  // --- Use Python soundcard script via child_process ---
  const pythonScriptPath = path.join(__dirname, 'record_soundcard.py');
  const pythonArgs = [
    pythonScriptPath,
    currentMeetingId!,
    currentSessionPath!,
    '3600', // Optional duration in seconds
  ];

  console.log(`Spawning Python: python3 ${pythonArgs.join(' ')}`);

  try {
    recorderProcess = spawn('backend/.venv/bin/python', pythonArgs);

    // Listen to stdout for "WROTE" messages
    recorderProcess.stdout.on('data', (data: Buffer) => {
      const output = data.toString().trim();
      const lines = output.split('\n');
      lines.forEach(line => {
        if (line.startsWith('WROTE')) {
          const filePath = line.split(' ')[1];
          if (filePath && currentMeetingId) {
            const fileName = path.basename(filePath);
            const chunkIndex = parseInt(fileName.split('_').pop()?.split('.')[0] || '0', 10);
            console.log(`Python script wrote chunk: ${filePath}`);
            sendChunkToBackend(filePath, currentMeetingId, fileName, chunkIndex);
          }
        }
      });
    });

    // Handle Python process errors and exit
    recorderProcess.stderr.on('data', (data) => {
      console.error(`Python stderr: ${data}`);
      // Consider stopping recording and notifying renderer on significant errors
    });

    recorderProcess.on('error', (err) => {
      console.error('Failed to start Python process:', err);
      stopRecording(); // Stop if Python fails to start
      // Notify renderer
       BrowserWindow.getAllWindows().forEach(win => {
         win.webContents.send('recording-status', 'error', 'Failed to start Python recorder');
       });
    });

    recorderProcess.on('close', (code) => {
      console.log(`Python process exited with code ${code}`);
      // If recording wasn't stopped manually, this indicates an unexpected exit
      if (recorderProcess) { // Check if it wasn't already cleared by stopRecording
         console.warn('Python process closed unexpectedly.');
         stopRecording(); // Ensure cleanup and notify renderer
         BrowserWindow.getAllWindows().forEach(win => {
           win.webContents.send('recording-status', 'error', `Recorder exited unexpectedly (code ${code})`);
         });
      }
    });

    console.log('Python process spawned, recording should start.');
    // Notify renderer that recording has started, including the meeting ID
    BrowserWindow.getAllWindows().forEach(win => {
       win.webContents.send('recording-started', currentMeetingId); // Send specific event with ID
    });

  } catch (error) {
    console.error(`Failed to spawn Python process: ${error}`);
    recorderProcess = null; // Ensure process handle is cleared
    currentSessionPath = null;
     // Notify renderer about the error?
      BrowserWindow.getAllWindows().forEach(win => {
         win.webContents.send('recording-status', 'error', 'Failed to start recording process');
       });
  }
}

function stopRecording() {
  if (!recorderProcess) { // Check if recorder process exists
    console.warn('Recording is not currently in progress.');
    return;
  }

  console.log('Attempting to stop recording (killing Python process)...');
  try {
    recorderProcess.kill('SIGTERM'); // Send termination signal to Python
    console.log('Sent SIGTERM to Python process.');

    // Process any remaining data in the buffer? (For simplicity, we discard it for now)

    // Clean up state
    const stoppedSessionPath = currentSessionPath;
    const stoppedMeetingId = currentMeetingId; // Store ID before clearing
    recorderProcess = null;
    currentSessionPath = null;
    chunkCounter = 0;
    currentMeetingId = null; // Clear the current meeting ID

    console.log(`Recording session saved in: ${stoppedSessionPath}`);

    // Call backend to finalize the meeting status
    if (stoppedMeetingId) {
        finalizeMeetingOnBackend(stoppedMeetingId); // Call helper function
    } else {
        console.error("Cannot finalize meeting: meeting ID was not available when recording stopped.");
    }

    // Notify renderer that recording has stopped
     BrowserWindow.getAllWindows().forEach(win => {
       win.webContents.send('recording-status', 'stopped');
    });

  } catch (error) {
    console.error(`Error stopping Python process: ${error}`);
    // Force cleanup state even if stop fails
    recorderProcess = null;
    currentSessionPath = null;
    chunkCounter = 0;
  }
}


// --- IPC Handlers for Recording Control ---
ipcMain.on('start-recording', () => {
  console.log(`IPC: Received start recording request.`);
  // The new python script handles device selection automatically
  startRecording();
});

ipcMain.on('stop-recording', () => {
  console.log('IPC: Received stop recording request.');
  stopRecording();
});

// --- Function to get recording devices using PowerShell ---
async function getRecordingDevices(): Promise<{ name: string; id: string }[]> {
  if (process.platform === 'win32') {
    const command =
      "powershell.exe -NoProfile -ExecutionPolicy Bypass -Command \"Get-AudioDevice -List | Where-Object {$_.Type -eq 'Recording'} | Select-Object -Property Name, ID | ConvertTo-Json -Compress\"";

    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error executing PowerShell command: ${error.message}`);
          console.error(`Stderr: ${stderr}`);
          if (
            stderr.includes('Get-AudioDevice') &&
            stderr.includes('not recognized')
          ) {
            console.error(
              "Get-AudioDevice cmdlet not found. Ensure the 'AudioDeviceCmdlets' module is installed: Install-Module -Name AudioDeviceCmdlets -Scope CurrentUser"
            );
            return reject(
              new Error('AudioDeviceCmdlets module not found. Please install it.')
            );
          }
          return reject(error);
        }
        if (stderr) {
          console.warn(`PowerShell stderr: ${stderr}`);
        }

        console.log('Raw PowerShell stdout:', stdout);

        try {
          const trimmedStdout = stdout.trim();
          if (!trimmedStdout) {
            console.warn('PowerShell stdout is empty after trimming.');
            return resolve([]);
          }
          const devices = JSON.parse(trimmedStdout);
          console.log('Parsed devices:', JSON.stringify(devices, null, 2));
          resolve(Array.isArray(devices) ? devices : [devices]);
        } catch (parseError) {
          console.error(`Error parsing PowerShell output: ${parseError}`);
          console.error(`Raw stdout: ${stdout}`);
          reject(parseError);
        }
      });
    });
  } else if (process.platform === 'linux') {
    return new Promise((resolve, reject) => {
      exec('arecord -l', (error, stdout, stderr) => {
        if (error) {
          console.error(`Error executing arecord: ${error.message}`);
          return reject(error);
        }
        if (stderr) {
          console.error(`arecord stderr: ${stderr}`);
        }
        const devices = stdout
          .split('\n')
          .filter((line) => line.startsWith('card'))
          .map((line) => {
            const match = line.match(/card (\d+): (.+?) \[(.+?)\], device (\d+):/);
            if (match) {
              const card = match[1];
              const deviceName = match[2];
              const device = match[4];
              return {
                name: `${deviceName} (hw:${card},${device})`,
                id: `hw:${card},${device}`,
              };
            }
            return null;
          })
          .filter((device) => device !== null) as { name: string; id: string }[];
        resolve(devices);
      });
    });
  } else {
    console.warn(
      `Audio device listing not supported on ${process.platform}.`
    );
    return Promise.resolve([]);
  }
}


// --- IPC Handler for Getting Recording Devices ---
ipcMain.handle('get-recording-devices', async () => {
  console.log('IPC: Received request for recording devices.');
  try {
    const devices = await getRecordingDevices();
    console.log('IPC: Sending recording devices:', devices);
    return devices;
  } catch (error) {
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
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file, you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

// --- IPC Handler for Sharing ---
ipcMain.on('share-content', (_event, content) => {
  console.log('Received content to share in main process.');

  if (!content) {
    console.error('No content received for sharing.');
    return;
  }

  // Platform-specific sharing logic
  if (process.platform === 'win32') {
    // Windows: Copy to clipboard and notify user
    clipboard.writeText(content);
    console.log('Content copied to clipboard (Windows).');

    console.log(`Notification support check: ${Notification.isSupported()}`);
    if (Notification.isSupported()) {
      try {
        console.log('Attempting to create notification...');
        const notification = new Notification({
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

      } catch (error) {
         console.error('Error creating or showing notification:', error);
      }
    } else {
      console.log('Notifications reported as not supported on this system.');
      // Optionally, show a dialog box as a fallback notification
      // dialog.showMessageBox({ type: 'info', title: 'Content Copied', message: 'Content copied to clipboard. Share manually.' });
    }
  } else if (process.platform === 'darwin') {
    // macOS: Placeholder - Use electron.shareItem (Electron 13+) or external lib
    console.log('macOS sharing not implemented yet. Content:', content);
    // Example using shareItem (requires Electron 13+):
    // if (app.isReady()) { // Ensure app is ready
    //   shareItem({ items: [content] }); // shareItem is async but doesn't return promise
    // }
    // Fallback: Copy to clipboard
    clipboard.writeText(content);
     console.log(`Notification support check (macOS): ${Notification.isSupported()}`);
    if (Notification.isSupported()) {
       try {
         const notification = new Notification({ title: 'Content Copied', body: 'Sharing not implemented, content copied to clipboard.' });
         notification.on('show', () => console.log('Notification shown successfully (macOS).'));
         notification.show();
       } catch (error) {
         console.error('Error creating or showing notification (macOS):', error);
       }
    } else {
       console.log('Notifications reported as not supported on this system (macOS).');
    }

  } else {
    // Linux/Other: Placeholder - Use xdg-share or similar
    console.log('Linux/Other platform sharing not implemented yet. Content:', content);
     // Fallback: Copy to clipboard
    clipboard.writeText(content);
    console.log(`Notification support check (Other): ${Notification.isSupported()}`);
     if (Notification.isSupported()) {
       try {
         const notification = new Notification({ title: 'Content Copied', body: 'Sharing not implemented, content copied to clipboard.' });
         notification.on('show', () => console.log('Notification shown successfully (Other).'));
         notification.show();
       } catch (error) {
         console.error('Error creating or showing notification (Other):', error);
       }
    } else {
       console.log('Notifications reported as not supported on this system (Other).');
    }
  }
});
