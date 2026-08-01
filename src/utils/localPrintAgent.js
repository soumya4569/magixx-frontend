/**
 * localPrintAgent.js (Reverted / Compatibility Layer)
 * Architecture has been reverted to direct Web Bluetooth API.
 * Delegates to bluetoothPrinter.js.
 */

export {
  getPrinterConfig,
  checkPrinterStreamStatus,
  attemptSeamlessReconnect,
  ensurePrinterConnected,
  sendToBluetoothPrinter,
  sendToBluetoothPrinter as sendToLocalPrintAgent,
  disconnectPrinterStream,
  logPrinterDeviceEvent,
} from './bluetoothPrinter';
