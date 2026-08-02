const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSystemPrinters: () => ipcRenderer.invoke('get-system-printers'),
  printReceipt: (data) => ipcRenderer.invoke('print-receipt', data),
});
