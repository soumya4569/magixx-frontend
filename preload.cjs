const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onBluetoothDevices: (callback) => {
    const listener = (_event, devices) => callback(devices);
    ipcRenderer.on('bluetooth-device-list', listener);
    return () => ipcRenderer.removeListener('bluetooth-device-list', listener);
  },
  selectBluetoothDevice: (deviceId) => ipcRenderer.send('choose-bluetooth-device', deviceId),
  cancelBluetoothDevice: () => ipcRenderer.send('cancel-bluetooth-device'),
});
