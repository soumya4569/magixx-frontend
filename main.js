import { app, BrowserWindow, session } from 'electron';

// Enable Web Bluetooth flags in Electron runtime
app.commandLine.appendSwitch('enable-experimental-web-platform-features');
app.commandLine.appendSwitch('enable-web-bluetooth');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'MAGIXX Sweets & Cafe POS',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
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

  // Handle Web Bluetooth device selection hook without auto-selecting random devices
  mainWindow.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
    event.preventDefault();

    // Do NOT auto-select or pick deviceList[0]. 
    // Storing the callback or allowing Chromium/Windows to present the interactive picker UI.
    // If you need to handle selection dynamically via user prompt, 
    // leaving this open or letting the browser handle the device chooser dialog natively:
    if (deviceList && deviceList.length > 0) {
      // Intentionally left open for user interaction or system chooser modal handling.
      // If a specific saved device ID matches a target, you can check it here, 
      // otherwise do not call callback() automatically so the manual picker stays active.
    }
  });

  mainWindow.loadURL('https://magixx-cafe.vercel.app/');
}

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