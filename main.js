import { app, BrowserWindow, session, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enable Web Bluetooth flags in Electron runtime
app.commandLine.appendSwitch('enable-experimental-web-platform-features');
app.commandLine.appendSwitch('enable-web-bluetooth');

let savedBluetoothCallback = null;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'MAGIXX Sweets & Cafe POS',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // Remove default native application menu bar
  mainWindow.setMenu(null);

  // Authorize session permission requests for Bluetooth hardware access & peripheral devices
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (
      permission === 'bluetooth' ||
      permission === 'bluetoothScanning' ||
      permission === 'devices'
    ) {
      callback(true);
      return;
    }
    callback(true);
  });

  // Authorize permission checks for Bluetooth hardware
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    if (
      permission === 'bluetooth' ||
      permission === 'bluetoothScanning' ||
      permission === 'devices'
    ) {
      return true;
    }
    return true;
  });

  // Authorize device permissions if handler method exists
  if (session.defaultSession.setDevicePermissionHandler) {
    session.defaultSession.setDevicePermissionHandler(() => true);
  }

  // Handle Web Bluetooth device selection hook by caching callback and forwarding deviceList to UI
  mainWindow.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
    event.preventDefault();
    savedBluetoothCallback = callback;
    
    // Forward discovered Bluetooth device list to renderer window
    mainWindow.webContents.send('bluetooth-device-list', deviceList);
  });

  mainWindow.loadURL('https://magixx-cafe.vercel.app/');
}

// IPC Listener to handle device selection from React modal UI
ipcMain.on('choose-bluetooth-device', (event, deviceId) => {
  if (savedBluetoothCallback) {
    savedBluetoothCallback(deviceId);
    savedBluetoothCallback = null;
  }
});

// IPC Listener to handle cancelling Bluetooth device selection
ipcMain.on('cancel-bluetooth-device', () => {
  if (savedBluetoothCallback) {
    savedBluetoothCallback('');
    savedBluetoothCallback = null;
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});