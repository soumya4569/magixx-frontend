/**
 * bluetoothPrinter.js
 * Native Electron Printer helper utility.
 * Replaces Web Bluetooth with silent native printing via Electron IPC (window.electronAPI.printReceipt).
 */

import api from '../services/api';

/**
 * Report printer device status and diagnostic logs to backend API.
 */
export const logPrinterDeviceEvent = async (printerType, deviceName, deviceAddress, eventType, message = '', details = {}) => {
  try {
    await api.post('/settings/printer-logs', {
      printerType,
      deviceName,
      deviceAddress,
      eventType,
      message,
      details,
    });
  } catch (err) {
    console.warn('[PrinterService] Failed to post printer log to backend:', err.message);
  }
};

/**
 * Read target printer configuration from localStorage.
 */
export const getPrinterConfig = (printerType = 'kot') => {
  let config = {
    name: '',
    address: '',
    serviceUUID: '000018f0-0000-1000-8000-00805f9b34fb',
  };

  try {
    const saved = localStorage.getItem('pos_printer_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (printerType === 'kot') {
        config.name = parsed.kotPrinterName || '';
        config.address = parsed.kotPrinterAddress || '';
        config.serviceUUID = parsed.kotPrinterServiceUUID || config.serviceUUID;
      } else {
        config.name = parsed.billingPrinterName || '';
        config.address = parsed.billingPrinterAddress || '';
        config.serviceUUID = parsed.billingPrinterServiceUUID || config.serviceUUID;
      }
    }
  } catch (err) {
    console.warn('[PrinterService] Failed to read printer config from localStorage:', err);
  }

  return config;
};

/**
 * Check if printer is configured.
 */
export const checkPrinterStreamStatus = (printerType) => {
  const config = getPrinterConfig(printerType);
  const isConfigured = Boolean(config.name);

  return {
    isConnected: isConfigured,
    deviceName: config.name || '',
    deviceAddress: config.address || '',
    lastUsed: new Date(),
  };
};

/**
 * Sends receipt text to the selected printer via Electron Native IPC.
 *
 * @param {'kot' | 'billing'} printerType Destination printer ('kot' or 'billing')
 * @param {string} receiptText Plain text receipt content
 * @param {Function} [toast] Toast callback handler
 * @returns {Promise<boolean>} True if print job submitted successfully, false if error
 */
export const sendToNativePrinter = async (printerType, receiptText, toast = console.log) => {
  const label = printerType === 'kot' ? 'Kitchen KOT' : 'Counter Billing';
  const config = getPrinterConfig(printerType);

  if (!window.electronAPI || typeof window.electronAPI.printReceipt !== 'function') {
    toast(`Native printing is only available when running inside the Electron POS app.`, 'warning');
    return false;
  }

  try {
    console.log(`[PrinterService] Submitting silent print job for ${label} to printer "${config.name || 'Default Printer'}"`);
    const result = await window.electronAPI.printReceipt({
      printerName: config.name || '',
      textContent: receiptText,
    });

    if (result && result.success) {
      logPrinterDeviceEvent(
        printerType,
        config.name || 'Default System Printer',
        'NATIVE_IPC',
        'PRINT_SUCCESS',
        'Receipt printed successfully via Electron Native IPC'
      );
      toast(`${label} printed successfully!`, 'success');
      return true;
    } else {
      const errorMsg = result?.error || 'Native print execution failed';
      console.error(`[PrinterService] Native print failed for ${label}:`, errorMsg);
      logPrinterDeviceEvent(
        printerType,
        config.name || 'Default System Printer',
        'NATIVE_IPC',
        'PRINT_FAILED',
        errorMsg
      );
      toast(`Print error on ${label}: ${errorMsg}`, 'error');
      return false;
    }
  } catch (err) {
    console.error(`[PrinterService] Exception during print call for ${label}:`, err);
    toast(`Print error on ${label}: ${err.message}`, 'error');
    return false;
  }
};

/**
 * Alias export for backward compatibility across existing React components.
 */
export const sendToBluetoothPrinter = sendToNativePrinter;

/**
 * Legacy disconnect stub function.
 */
export const disconnectPrinterStream = () => {};
