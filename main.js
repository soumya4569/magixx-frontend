import { app, BrowserWindow, session, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'MAGIXX Sweets & Cafe POS',
    icon: path.join(__dirname, 'build/icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // Remove default native application menu bar
  mainWindow.setMenu(null);

  mainWindow.loadURL('https://magixx-cafe.vercel.app/');
}

// IPC Listener to fetch all installed system/Windows printers (including OS-paired Bluetooth thermal printers)
ipcMain.handle('get-system-printers', async (event) => {
  try {
    const printers = await event.sender.getPrintersAsync();
    return printers || [];
  } catch (err) {
    console.error('[Electron Main] Error fetching system printers:', err);
    return [];
  }
});

// IPC Listener to handle silent native thermal receipt printing via Electron webContents
ipcMain.handle('print-receipt', async (event, { printerName, textContent }) => {
  // Strict Guard Clause: Abort immediately if no valid printer device name is selected
  if (!printerName || typeof printerName !== 'string' || printerName.trim() === '') {
    console.warn('[Electron Main] Silent print aborted: No printer device name specified in settings.');
    return {
      success: false,
      error: 'No printer selected. Please select a target printer in POS Settings first.',
    };
  }

  const targetPrinterName = printerName.trim();

  return new Promise((resolve) => {
    let printWindow = null;
    try {
      printWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      const safeText = (textContent || '')
        .replace(/[\u20B9₹]/g, 'Rs.')
        .replace(/\?+(?=\s*Rs\.|\s*\d)/gi, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { margin: 0; size: 58mm auto; }
    html, body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      line-height: 1.2;
      width: 50mm;
      max-width: 50mm;
      margin: 0 auto;
      padding: 2px 0;
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: break-word;
      color: #000;
      box-sizing: border-box;
    }
  </style>
</head>
<body>${safeText}</body>
</html>`;

      printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

      printWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        // Handles cases where the data: URI fails to load in the hidden window
        // (rare, but can occur with certain virtual or restricted print drivers).
        console.error(
          `[IPC print-receipt] ✗ Receipt HTML failed to load in hidden window: [${errorCode}] ${errorDescription}`
        );
        console.error(
          `[IPC print-receipt] Hint: This may indicate a sandboxing or driver restriction. Verify Electron webPreferences.`
        );
        if (printWindow && !printWindow.isDestroyed()) {
          printWindow.close();
        }
        resolve({
          success: false,
          error: `Receipt content failed to load (${errorCode}): ${errorDescription}`,
        });
      });

      printWindow.webContents.on('did-finish-load', () => {
        const options = {
          silent: true,
          printBackground: true,
          margins: { marginType: 'none' },
          deviceName: targetPrinterName,
        };

        printWindow.webContents.print(options, (success, failureReason) => {
          if (printWindow && !printWindow.isDestroyed()) {
            printWindow.close();
          }
          if (success) {
            console.log(
              `[IPC print-receipt] ✓ Receipt dispatched to printer "${targetPrinterName}" successfully.`
            );
            resolve({ success: true });
          } else {
            const reason = failureReason || 'Unknown print failure (no reason returned by OS spooler)';
            console.error(
              `[IPC print-receipt] ✗ Print failed on "${targetPrinterName}": ${reason}`
            );
            console.error(
              `[IPC print-receipt] Hint: Verify the printer name exactly matches the Windows device name, ` +
              `confirm the USB cable is connected, and check the Windows print spooler service is running.`
            );
            resolve({ success: false, error: reason });
          }
        });
      });
    } catch (err) {
      console.error('[Electron Main] Error during native print execution:', err);
      if (printWindow && !printWindow.isDestroyed()) {
        printWindow.close();
      }
      resolve({ success: false, error: err.message });
    }
  });
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