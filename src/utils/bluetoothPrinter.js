/**
 * bluetoothPrinter.js
 * Dedicated Web Bluetooth helper utility for dual EZO / ESC/POS thermal printer management.
 * Handles device discovery, active stream health verification, seamless re-connection,
 * graceful pairing re-prompting, ESC/POS byte streaming, and backend device status logging.
 */

import api from '../services/api';

// Internal memory stream cache for active GATT connections
const streamCache = {
  kot: { device: null, server: null, service: null, characteristic: null, lastUsed: null },
  billing: { device: null, server: null, service: null, characteristic: null, lastUsed: null },
};

/**
 * Send printer status and event log to backend API.
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
    console.warn('[BluetoothPrinter] Failed to send printer log to backend:', err.message);
  }
};

/**
 * Read target printer configuration from localStorage or defaults.
 */
export const getPrinterConfig = (printerType) => {
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
    console.warn('[BluetoothPrinter] Failed to read printer config from localStorage:', err);
  }

  return config;
};

/**
 * Check if active Bluetooth GATT server stream is connected and operational.
 */
export const checkPrinterStreamStatus = (printerType) => {
  const cache = streamCache[printerType];
  const isConnected = Boolean(
    cache &&
    cache.device &&
    cache.server &&
    cache.server.connected &&
    cache.characteristic
  );

  return {
    isConnected,
    deviceName: cache?.device?.name || '',
    deviceAddress: cache?.device?.id || '',
    lastUsed: cache?.lastUsed || null,
  };
};

/**
 * Attach disconnect handler to a Bluetooth device to reactively track stream loss.
 */
const attachDisconnectListener = (device, printerType) => {
  if (!device) return;

  const handleDisconnect = () => {
    console.warn(`[BluetoothPrinter] Active GATT server stream lost for ${printerType} printer ("${device.name || device.id}").`);
    streamCache[printerType] = { device: null, server: null, service: null, characteristic: null, lastUsed: null };
    logPrinterDeviceEvent(
      printerType,
      device.name || '',
      device.id || '',
      'DISCONNECTED',
      'Device stream lost or disconnected by hardware/range'
    );
  };

  device.removeEventListener('gattserverdisconnected', handleDisconnect);
  device.addEventListener('gattserverdisconnected', handleDisconnect);
};

/**
 * Resolve GATT service and writable characteristic from a connected server.
 */
const resolveServiceAndCharacteristic = async (server, primaryUUID) => {
  let service = null;

  try {
    service = await server.getPrimaryService(primaryUUID);
  } catch {
    const fallbackUUIDs = [
      '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
      '000018f0-0000-1000-8000-00805f9b34fb',
      '0000fff0-0000-1000-8000-00805f9b34fb',
    ];
    for (const uuid of fallbackUUIDs) {
      try {
        service = await server.getPrimaryService(uuid);
        break;
      } catch { /* continue */ }
    }
  }

  if (!service) return { service: null, characteristic: null };

  let characteristic = null;
  const writeUUIDs = [
    '000018f1-0000-1000-8000-00805f9b34fb',
    '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
    '0000fff2-0000-1000-8000-00805f9b34fb',
  ];

  for (const charUUID of writeUUIDs) {
    try {
      characteristic = await service.getCharacteristic(charUUID);
      break;
    } catch { /* continue */ }
  }

  if (!characteristic) {
    try {
      const characteristics = await service.getCharacteristics();
      characteristic = characteristics.find(
        (c) => c.properties.write || c.properties.writeWithoutResponse
      );
    } catch { /* ignore */ }
  }

  return { service, characteristic };
};

/**
 * Attempt seamless re-connection using cached device reference or navigator.bluetooth.getDevices().
 */
export const attemptSeamlessReconnect = async (printerType) => {
  const { name, address, serviceUUID } = getPrinterConfig(printerType);
  let targetDevice = streamCache[printerType]?.device || null;

  try {
    // If no cached device object, check browser allowed devices pool if supported
    if (!targetDevice && navigator.bluetooth && typeof navigator.bluetooth.getDevices === 'function') {
      const allowedDevices = await navigator.bluetooth.getDevices();
      if (allowedDevices && allowedDevices.length > 0) {
        targetDevice = allowedDevices.find(
          (d) => (address && d.id === address) || (name && d.name === name)
        );
      }
    }

    if (!targetDevice) return null;

    console.log(`[BluetoothPrinter] Attempting seamless reconnect to "${targetDevice.name || targetDevice.id}"...`);
    const server = await targetDevice.gatt.connect();

    const { service, characteristic } = await resolveServiceAndCharacteristic(server, serviceUUID);
    if (!service || !characteristic) {
      if (server.connected) server.disconnect();
      return null;
    }

    attachDisconnectListener(targetDevice, printerType);
    const activeStream = {
      device: targetDevice,
      server,
      service,
      characteristic,
      lastUsed: new Date(),
    };
    streamCache[printerType] = activeStream;

    logPrinterDeviceEvent(
      printerType,
      targetDevice.name || name,
      targetDevice.id || address,
      'RECONNECTED',
      'Seamless stream re-connection succeeded without browser prompt'
    );

    return activeStream;
  } catch (err) {
    console.warn(`[BluetoothPrinter] Seamless reconnect failed for ${printerType}:`, err.message);
    return null;
  }
};

/**
 * Ensure printer stream is connected:
 * 1. Uses existing active stream if healthy.
 * 2. Attempts seamless re-connection if disconnected.
 * 3. Fallback: Gracefully prompts browser device pairing dialog.
 */
export const ensurePrinterConnected = async (printerType, toast = console.log) => {
  const label = printerType === 'kot' ? 'Kitchen KOT' : 'Counter Billing';

  if (!navigator.bluetooth) {
    toast(`No Bluetooth support in this browser. Use Chrome or Edge on desktop to print to ${label} printer.`, 'warning');
    return null;
  }

  const { name, address, serviceUUID } = getPrinterConfig(printerType);
  if (!name && !address) {
    toast(`No ${label} printer configured. Go to Settings → Hardware & Printers to pair a printer.`, 'warning');
    return null;
  }

  // 1. Check existing active stream health
  const currentCache = streamCache[printerType];
  if (
    currentCache &&
    currentCache.device &&
    currentCache.server &&
    currentCache.server.connected &&
    currentCache.characteristic
  ) {
    currentCache.lastUsed = new Date();
    return currentCache;
  }

  // 2. Stream is lost/disconnected — attempt seamless re-connection
  const reconnectedStream = await attemptSeamlessReconnect(printerType);
  if (reconnectedStream) {
    toast(`Seamlessly reconnected to ${label} printer ("${reconnectedStream.device.name || name}").`, 'success');
    return reconnectedStream;
  }

  // 3. Seamless reconnect failed — gracefully prompt pairing mechanism
  try {
    toast(`Printer stream disconnected. Prompting pairing for ${label}...`, 'info');
    logPrinterDeviceEvent(printerType, name, address, 'PAIRING_REQUIRED', 'Seamless reconnect unavailable; re-prompting pairing dialog');

    const filters = [];
    if (name) filters.push({ name });
    if (address) filters.push({ name: address });

    const requestOptions = {
      filters: filters.length > 0 ? filters : undefined,
      acceptAllDevices: filters.length === 0,
      optionalServices: [
        serviceUUID,
        '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
        '000018f0-0000-1000-8000-00805f9b34fb',
        '0000fff0-0000-1000-8000-00805f9b34fb',
      ],
    };

    const device = await navigator.bluetooth.requestDevice(requestOptions);
    if (!device) {
      logPrinterDeviceEvent(printerType, name, address, 'PAIRING_CANCELLED', 'Device selection dialog closed without choice');
      return null;
    }

    const server = await device.gatt.connect();
    const { service, characteristic } = await resolveServiceAndCharacteristic(server, serviceUUID);

    if (!characteristic) {
      if (server.connected) server.disconnect();
      toast(`Could not find writable GATT characteristic on "${device.name || name}". Check Settings.`, 'error');
      logPrinterDeviceEvent(printerType, device.name || name, device.id || address, 'PRINT_FAILED', 'GATT service/characteristic missing');
      return null;
    }

    attachDisconnectListener(device, printerType);
    const newStream = {
      device,
      server,
      service,
      characteristic,
      lastUsed: new Date(),
    };
    streamCache[printerType] = newStream;

    logPrinterDeviceEvent(printerType, device.name || name, device.id || address, 'CONNECTED', 'Device paired and GATT stream connected');
    toast(`Paired and connected to ${label} printer ("${device.name || name}").`, 'success');

    return newStream;
  } catch (err) {
    if (err.name === 'NotFoundError') {
      toast(`Bluetooth device selection cancelled. Re-click print when ready to pair.`, 'warning');
      logPrinterDeviceEvent(printerType, name, address, 'PAIRING_CANCELLED', 'User cancelled Bluetooth pairing picker');
      return null;
    }
    console.error(`[BluetoothPrinter] Pairing / connection error for ${label}:`, err);
    toast(`Printer connection failed: ${err.message}`, 'error');
    logPrinterDeviceEvent(printerType, name, address, 'PRINT_FAILED', err.message);
    return null;
  }
};

/**
 * Sends formatted ESC/POS plain text to a targeted Bluetooth thermal printer.
 * Handles stream health verification, auto reconnect, re-pairing, and byte streaming.
 *
 * @param {'kot' | 'billing'} printerType - Destination printer ('kot' or 'billing')
 * @param {string} receiptText - Plain text receipt formatted with ESC/POS markers
 * @param {Function} [toast] - Optional custom toast notification handler
 * @returns {Promise<boolean>} True if print succeeded, false if unconfigured or error
 */
export const sendToBluetoothPrinter = async (printerType, receiptText, toast = console.log) => {
  const label = printerType === 'kot' ? 'Kitchen KOT' : 'Counter Billing';

  const stream = await ensurePrinterConnected(printerType, toast);
  if (!stream || !stream.characteristic) {
    return false;
  }

  try {
    // ESC/POS Command Byte Formatting
    const initCmd = new Uint8Array([0x1b, 0x40]); // ESC @ (initialize printer)
    const cutCmd = new Uint8Array([0x1d, 0x56, 0x42, 0x00]); // GS V B (paper cut)

    const encoder = new TextEncoder();
    const textBytes = encoder.encode((receiptText || '') + '\n\n\n');

    const fullBytes = new Uint8Array(initCmd.length + textBytes.length + cutCmd.length);
    fullBytes.set(initCmd, 0);
    fullBytes.set(textBytes, initCmd.length);
    fullBytes.set(cutCmd, initCmd.length + textBytes.length);

    // Stream byte chunks to printer
    const characteristic = stream.characteristic;
    const useWriteWithoutResponse =
      characteristic.properties.writeWithoutResponse && !characteristic.properties.write;
    const CHUNK_SIZE = 512;

    for (let offset = 0; offset < fullBytes.length; offset += CHUNK_SIZE) {
      const chunk = fullBytes.slice(offset, offset + CHUNK_SIZE);
      if (useWriteWithoutResponse) {
        await characteristic.writeValueWithoutResponse(chunk);
      } else {
        await characteristic.writeValue(chunk);
      }
    }

    stream.lastUsed = new Date();
    logPrinterDeviceEvent(
      printerType,
      stream.device?.name || '',
      stream.device?.id || '',
      'PRINT_SUCCESS',
      `Successfully printed receipt (${fullBytes.length} bytes)`
    );

    return true;
  } catch (err) {
    console.error(`[BluetoothPrinter] Error streaming bytes to ${label}:`, err);
    // Invalidate stream on write error
    streamCache[printerType] = { device: null, server: null, service: null, characteristic: null, lastUsed: null };

    logPrinterDeviceEvent(
      printerType,
      stream.device?.name || '',
      stream.device?.id || '',
      'PRINT_FAILED',
      `Stream error during write: ${err.message}`
    );

    // Attempt one silent reconnect and retry
    toast(`Printer stream interrupted during write. Attempting automatic reconnection...`, 'warning');
    const retryStream = await attemptSeamlessReconnect(printerType);
    if (retryStream && retryStream.characteristic) {
      try {
        const initCmd = new Uint8Array([0x1b, 0x40]);
        const cutCmd = new Uint8Array([0x1d, 0x56, 0x42, 0x00]);
        const encoder = new TextEncoder();
        const textBytes = encoder.encode((receiptText || '') + '\n\n\n');
        const fullBytes = new Uint8Array(initCmd.length + textBytes.length + cutCmd.length);
        fullBytes.set(initCmd, 0);
        fullBytes.set(textBytes, initCmd.length);
        fullBytes.set(cutCmd, initCmd.length + textBytes.length);

        const retryChar = retryStream.characteristic;
        const useWriteWithoutResp = retryChar.properties.writeWithoutResponse && !retryChar.properties.write;
        for (let offset = 0; offset < fullBytes.length; offset += 512) {
          const chunk = fullBytes.slice(offset, offset + 512);
          if (useWriteWithoutResp) {
            await retryChar.writeValueWithoutResponse(chunk);
          } else {
            await retryChar.writeValue(chunk);
          }
        }
        toast(`Printed successfully after re-connecting to ${label}!`, 'success');
        logPrinterDeviceEvent(printerType, retryStream.device?.name || '', retryStream.device?.id || '', 'PRINT_SUCCESS', 'Printed on retry after stream reconnect');
        return true;
      } catch (retryErr) {
        console.error(`[BluetoothPrinter] Retry failed for ${label}:`, retryErr);
      }
    }

    toast(`Bluetooth print error on ${label}: ${err.message}. Please check printer power and range.`, 'error');
    return false;
  }
};

/**
 * Manually disconnect cached printer GATT server stream.
 */
export const disconnectPrinterStream = (printerType) => {
  const cache = streamCache[printerType];
  if (cache && cache.server && cache.server.connected) {
    try {
      cache.server.disconnect();
    } catch { /* ignore */ }
  }
  streamCache[printerType] = { device: null, server: null, service: null, characteristic: null, lastUsed: null };
};
