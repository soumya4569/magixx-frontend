/**
 * localPrintAgent.js
 * Local Print Agent thermal printing utility for MAGIXX POS.
 * Replaces Web Bluetooth browser APIs with HTTP POST requests to a Local Print Agent
 * service (default: http://localhost:3000/print) or routed via cloud backend (/api/print/dispatch).
 */

import api from '../services/api';

/**
 * Report printer device status / event log to cloud backend API.
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
    console.warn('[LocalPrintAgent] Failed to post printer event log to backend:', err.message);
  }
};

/**
 * Read current printer and local agent configuration from localStorage.
 */
export const getPrinterConfig = (printerType = 'kot') => {
  let config = {
    printAgentUrl: 'http://localhost:3000/print',
    printDispatchMode: 'local_direct', // 'local_direct' | 'backend_proxy'
    kotPrinterIdentifier: 'KOT_Thermal_Printer',
    billingPrinterIdentifier: 'Billing_Thermal_Printer',
    kotPrinterAddress: '',
    billingPrinterAddress: '',
    name: '',
    address: '',
  };

  try {
    const saved = localStorage.getItem('pos_printer_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      config.printAgentUrl = parsed.printAgentUrl || config.printAgentUrl;
      config.printDispatchMode = parsed.printDispatchMode || config.printDispatchMode;
      config.kotPrinterIdentifier = parsed.kotPrinterIdentifier || parsed.kotPrinterName || config.kotPrinterIdentifier;
      config.billingPrinterIdentifier = parsed.billingPrinterIdentifier || parsed.billingPrinterName || config.billingPrinterIdentifier;
      config.kotPrinterAddress = parsed.kotPrinterAddress || '';
      config.billingPrinterAddress = parsed.billingPrinterAddress || '';

      if (printerType === 'kot') {
        config.name = config.kotPrinterIdentifier;
        config.address = config.kotPrinterAddress;
      } else {
        config.name = config.billingPrinterIdentifier;
        config.address = config.billingPrinterAddress;
      }
    }
  } catch (err) {
    console.warn('[LocalPrintAgent] Failed to parse pos_printer_settings from localStorage:', err);
  }

  return config;
};

/**
 * Health check endpoint for Local Print Agent.
 */
export const checkLocalPrintAgentHealth = async (customUrl) => {
  const { printAgentUrl } = getPrinterConfig();
  const targetUrl = customUrl || printAgentUrl || 'http://localhost:3000/print';

  try {
    // Try pinging local print agent directly
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ping: true, timestamp: new Date().toISOString() }),
    });

    if (res.ok) {
      return { isHealthy: true, agentUrl: targetUrl, message: 'Local Print Agent is active and responsive' };
    }
  } catch {
    // Fallback: ping via backend health proxy endpoint
    try {
      const backendRes = await api.post('/print/health', { agentUrl: targetUrl });
      if (backendRes.data && backendRes.data.isHealthy) {
        return { isHealthy: true, agentUrl: targetUrl, message: 'Local Print Agent reachable via backend' };
      }
    } catch (e) {
      console.warn('[LocalPrintAgent] Backend print health check warning:', e.message);
    }
  }

  return {
    isHealthy: false,
    agentUrl: targetUrl,
    message: `Cannot connect to Local Print Agent at ${targetUrl}. Ensure local print agent service is running on port 3000.`,
  };
};

/**
 * Dispatch print payload to Local Print Agent service via HTTP POST.
 *
 * @param {'kot' | 'billing'} printerType Destination printer ('kot' or 'billing')
 * @param {string} receiptText ESC/POS formatted receipt plain text
 * @param {Function} [toast] Custom toast handler
 * @returns {Promise<boolean>} True if print job dispatched successfully, false otherwise
 */
export const sendToLocalPrintAgent = async (printerType, receiptText, toast = console.log) => {
  const label = printerType === 'kot' ? 'Kitchen KOT' : 'Counter Billing';
  const config = getPrinterConfig(printerType);

  const targetPrinterName = printerType === 'kot' ? config.kotPrinterIdentifier : config.billingPrinterIdentifier;
  const targetPrinterAddress = printerType === 'kot' ? config.kotPrinterAddress : config.billingPrinterAddress;

  const payload = {
    printerType,
    printerName: targetPrinterName,
    printerAddress: targetPrinterAddress,
    receiptText: receiptText || '',
    timestamp: new Date().toISOString(),
  };

  // Option 1: Backend Proxy Mode
  if (config.printDispatchMode === 'backend_proxy') {
    try {
      toast(`Sending ${label} print job via cloud backend proxy...`, 'info');
      const res = await api.post('/print/dispatch', payload);
      if (res.data && res.data.success) {
        toast(`${label} print job dispatched successfully!`, 'success');
        logPrinterDeviceEvent(printerType, targetPrinterName, targetPrinterAddress, 'PRINT_SUCCESS', `Dispatched via backend proxy to ${config.printAgentUrl}`);
        return true;
      }
    } catch (err) {
      console.warn('[LocalPrintAgent] Backend proxy print dispatch error:', err.message);
    }
  }

  // Option 2: Direct Local Agent HTTP POST (default)
  try {
    toast(`Dispatching ${label} to Local Print Agent (${config.printAgentUrl})...`, 'info');

    const agentRes = await fetch(config.printAgentUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (agentRes.ok) {
      toast(`${label} print job received by Local Print Agent!`, 'success');
      logPrinterDeviceEvent(printerType, targetPrinterName, targetPrinterAddress, 'PRINT_SUCCESS', `Successfully printed via ${config.printAgentUrl}`);
      return true;
    } else {
      throw new Error(`Local Agent returned HTTP status ${agentRes.status}`);
    }
  } catch (directErr) {
    console.warn(`[LocalPrintAgent] Direct HTTP POST to ${config.printAgentUrl} failed:`, directErr.message);

    // Fallback: Dispatch via cloud backend proxy if direct post fails
    try {
      toast(`Direct connection to Local Agent failed. Retrying via backend proxy...`, 'warning');
      const res = await api.post('/print/dispatch', payload);
      if (res.data && res.data.success) {
        toast(`${label} print job dispatched via cloud backend fallback!`, 'success');
        logPrinterDeviceEvent(printerType, targetPrinterName, targetPrinterAddress, 'PRINT_SUCCESS', 'Printed via cloud backend fallback');
        return true;
      }
    } catch (backendErr) {
      console.error('[LocalPrintAgent] Fallback print dispatch error:', backendErr.message);
    }

    logPrinterDeviceEvent(
      printerType,
      targetPrinterName,
      targetPrinterAddress,
      'PRINT_FAILED',
      `Failed to connect to Local Print Agent at ${config.printAgentUrl}: ${directErr.message}`
    );

    toast(
      `Print failed: Could not connect to Local Print Agent at ${config.printAgentUrl}. Please start your local print service (http://localhost:3000/print).`,
      'error'
    );
    return false;
  }
};

// Aliases for compatibility
export const sendToBluetoothPrinter = sendToLocalPrintAgent;
export const checkPrinterStreamStatus = () => ({ isConnected: true });
