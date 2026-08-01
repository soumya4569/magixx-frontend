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

  // Handle Web Bluetooth device selection hook from webContents
  mainWindow.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
    event.preventDefault();
    if (deviceList && deviceList.length > 0) {
      // Find a target device with a non-empty name or fallback to the first discovered peripheral
      const targetDevice = deviceList.find((d) => d.deviceName && d.deviceName.trim().length > 0) || deviceList[0];
      callback(targetDevice.deviceId);
    } else {
      callback('');
    }
  });

  mainWindow.loadURL('https://magixx-frontend.vercel.app/');
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
