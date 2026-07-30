/**
 * bluetoothPrinter.js
 * Dedicated Web Bluetooth helper utility for dual EZO / ESC/POS thermal printer management.
 * Handles device discovery, targeted Bluetooth printing by name/address, ESC/POS byte streaming,
 * and immediate GATT server disconnection.
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
 * Sends formatted ESC/POS plain text to a targeted Bluetooth thermal printer.
 *
 * @param {'kot' | 'billing'} printerType - Destination printer ('kot' for Kitchen, 'billing' for Counter)
 * @param {string} receiptText - Plain text content formatted with ESC/POS markers
 * @param {Function} [toast] - Optional custom toast notification handler
 * @returns {Promise<boolean>} True if print succeeded and printed, false if error or unconfigured
 */
export const sendToBluetoothPrinter = async (printerType, receiptText, toast = console.log) => {
  const label = printerType === 'kot' ? 'Kitchen KOT' : 'Counter Billing';

  // Check browser Web Bluetooth API support
  if (!navigator.bluetooth) {
    toast(`No Bluetooth support in this browser. Use Chrome or Edge on desktop to print to ${label} printer.`, 'warning');
    return false;
  }

  const { name, address, serviceUUID } = getPrinterConfig(printerType);

  // Verification: Ensure target printer address/name is configured
  if (!name && !address) {
    toast(`No ${label} printer configured. Go to Settings → Hardware & Printers to pair a Bluetooth printer address.`, 'warning');
    return false;
  }

  let device = null;

  try {
    // Build Web Bluetooth request filter (targeting by name or address identifier)
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

    device = await navigator.bluetooth.requestDevice(requestOptions);
    if (!device) return false;

    // Connect to GATT Server
    const server = await device.gatt.connect();

    // Resolve Primary Service
    let service = null;
    try {
      service = await server.getPrimaryService(serviceUUID);
    } catch {
      // Fallback service UUIDs
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

    if (!service) {
      if (device.gatt.connected) device.gatt.disconnect();
      toast(`Could not find GATT service on "${name || address}". Check Service UUID in Settings.`, 'error');
      return false;
    }

    // Resolve Writable Characteristic
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

    if (!characteristic) {
      if (device.gatt.connected) device.gatt.disconnect();
      toast(`No writable characteristic found on "${name || address}".`, 'error');
      return false;
    }

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

    // Immediate GATT server disconnection
    if (device && device.gatt && device.gatt.connected) {
      device.gatt.disconnect();
    }

    return true;
  } catch (err) {
    if (device && device.gatt && device.gatt.connected) {
      device.gatt.disconnect();
    }
    if (err.name === 'NotFoundError') {
      // User cancelled Bluetooth device selection dialog
      return false;
    }
    console.error(`[BluetoothPrinter] Error printing to ${label}:`, err);
    toast(`Bluetooth print error: ${err.message}`, 'error');
    return false;
  }
};
