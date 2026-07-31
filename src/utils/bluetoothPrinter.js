/**
 * bluetoothPrinter.js (Compatibility Layer)
 * Proxies printing requests to the Local Print Agent architecture.
 */

export {
  getPrinterConfig,
  checkLocalPrintAgentHealth,
  sendToLocalPrintAgent,
  sendToBluetoothPrinter,
  checkPrinterStreamStatus,
  logPrinterDeviceEvent,
} from './localPrintAgent';
