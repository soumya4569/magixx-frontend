/**
 * receiptGenerator.js
 * 58mm Thermal Receipt HTML & Plain Text Generator
 * Strictly matches 58mm styled inline HTML/CSS table specification.
 */

/**
 * Centering helper for fixed width text (32 chars default).
 */
export const centerText = (str, width = 32) => {
  const s = String(str || '').trim();
  if (!s) return '';
  if (s.length >= width) return s.slice(0, width);
  const pad = Math.floor((width - s.length) / 2);
  return ' '.repeat(pad) + s;
};

/**
 * Wraps text into lines of max `width` characters and centers each line.
 */
export const wrapAndCenterText = (str, width = 32) => {
  if (!str || !String(str).trim()) return [];
  const words = String(str).trim().split(/\s+/);
  const rawLines = [];
  let currentLine = '';

  words.forEach((word) => {
    if ((currentLine + (currentLine ? ' ' : '') + word).length <= width) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) rawLines.push(currentLine);
      let remaining = word;
      while (remaining.length > width) {
        rawLines.push(remaining.slice(0, width));
        remaining = remaining.slice(width);
      }
      currentLine = remaining;
    }
  });
  if (currentLine) rawLines.push(currentLine);

  return rawLines.map((line) => centerText(line, width));
};

/**
 * Build 32-character line with left, centered, and right aligned strings.
 */
export const build32CharLine = (leftStr, centerStr, rightStr, width = 32) => {
  const left = String(leftStr ?? '');
  const center = String(centerStr ?? '');
  const right = String(rightStr ?? '');

  const lineArr = new Array(width).fill(' ');

  for (let i = 0; i < left.length && i < width; i++) {
    lineArr[i] = left[i];
  }

  const rightStart = width - right.length;
  for (let i = 0; i < right.length && (rightStart + i) < width; i++) {
    if (rightStart + i >= 0) {
      lineArr[rightStart + i] = right[i];
    }
  }

  let centerStart = Math.floor((width - center.length) / 2);
  if (centerStart < left.length + 1) {
    centerStart = left.length + 1;
  }
  if (centerStart + center.length > rightStart - 1) {
    centerStart = Math.max(left.length + 1, rightStart - 1 - center.length);
  }
  for (let i = 0; i < center.length && (centerStart + i) < width; i++) {
    if (centerStart + i >= 0 && centerStart + i < rightStart) {
      lineArr[centerStart + i] = center[i];
    }
  }

  return lineArr.join('');
};

/**
 * Format total row for fixed text width.
 */
export const formatTotalRow = (label, value, width = 32) => {
  const valStr = typeof value === 'number' ? value.toFixed(2) : String(value ?? '0.00');
  const lblStr = String(label ?? '');
  const availableSpace = width - valStr.length;
  const paddedLabel = lblStr.padEnd(Math.max(0, availableSpace));
  return `${paddedLabel}${valStr}`.slice(0, width);
};

/**
 * Generate 58mm Thermal HTML Receipt Layout strictly matching fixed table CSS layout specs.
 */
export const generateThermalReceiptHTML = (orderData = {}, settings = {}) => {
  const storeName = settings.storeName || orderData.storeName || 'Magixx Sweets & Cafe';
  let rawAddress = settings.address || orderData.address || 'Opposite of Kalyan Mandap, Joda, - 756121';
  if (!/^address:/i.test(rawAddress.trim())) {
    rawAddress = `Address: ${rawAddress.trim()}`;
  }
  const gstinVal = settings.gstin || orderData.gstin || '21ATDPK9131G1Z1';
  const phoneVal = settings.phone || orderData.phone || '7001322855';

  const invoiceNo = orderData.invoiceNo || orderData.orderId || (orderData.tokenNumber ? `ORD-${orderData.tokenNumber}` : `ORD-${Date.now().toString().slice(-6)}`);
  const dateTime = orderData.dateTime || orderData.date || `${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  const orderType = orderData.orderType || orderData.type || 'Dine-in';
  const payMethod = orderData.paymentMethod || orderData.pay || orderData.method || 'Cash';

  const items = orderData.items || orderData.cart || [];
  const subtotal = Number(orderData.subtotal ?? items.reduce((sum, i) => sum + (Number(i.price || 0) * Number(i.qty || 1)), 0));
  const taxRate = Number(settings.taxRate || orderData.taxRate || 5);
  const cgstRate = taxRate / 2;
  const sgstRate = taxRate / 2;

  const cgstAmount = Number(orderData.cgstAmount ?? ((subtotal * cgstRate) / 100));
  const sgstAmount = Number(orderData.sgstAmount ?? ((subtotal * sgstRate) / 100));
  const grandTotal = Number(orderData.total ?? orderData.grandTotal ?? (subtotal + cgstAmount + sgstAmount));

  const formatVal = (val) => {
    const num = Number(val || 0);
    return Number.isInteger(num) ? String(num) : num.toFixed(2);
  };

  const hrStyle = "border: none; border-top: 1px dashed #000; margin: 4px 0; padding: 0;";

  return `
    <div style="width: 58mm; max-width: 58mm; margin: 0 auto; padding: 0; font-family: 'Courier New', Courier, monospace; font-size: 11px; line-height: 1.2; word-break: break-word; overflow-x: hidden; color: #000; box-sizing: border-box; text-align: left;">
      
      <!-- 1. Header Section (Centered) -->
      <div style="text-align: center;">
        <div style="font-weight: bold; font-size: 12px; text-transform: uppercase;">${storeName}</div>
        <div style="font-size: 10px; word-break: break-word;">${rawAddress}</div>
        <div style="font-size: 10px;">GSTIN - ${gstinVal}</div>
        <div style="font-size: 10px;">Phone - ${phoneVal}</div>
        <hr style="${hrStyle}" />
        <div style="font-weight: bold; font-size: 12px; letter-spacing: 1px;">INVOICE</div>
        <hr style="${hrStyle}" />
      </div>

      <!-- 2. Order Information (Left-Aligned) -->
      <div style="text-align: left; font-size: 10px;">
        <div>Invoice No - ${invoiceNo}</div>
        <div>Date/time - ${dateTime}</div>
        <div>Type - ${orderType}</div>
        <div>Pay - ${payMethod}</div>
        <hr style="${hrStyle}" />
      </div>

      <!-- 3. Item List Structure (2-Line Row Layout with Fixed HTML Table) -->
      <table style="width: 100%; table-layout: fixed; border-collapse: collapse; margin: 0; padding: 0;">
        <thead>
          <tr>
            <th colspan="3" style="text-align: left; font-weight: bold; font-size: 11px; padding: 2px 0 1px 0;">Item Name</th>
          </tr>
          <tr>
            <th style="width: 20%; text-align: left; font-weight: bold; font-size: 10px; padding-bottom: 2px;">Qty.</th>
            <th style="width: 40%; text-align: center; font-weight: bold; font-size: 10px; padding-bottom: 2px;">Price</th>
            <th style="width: 40%; text-align: right; font-weight: bold; font-size: 10px; padding-bottom: 2px;">Amount</th>
          </tr>
        </thead>
      </table>
      <hr style="${hrStyle}" />

      <table style="width: 100%; table-layout: fixed; border-collapse: collapse; margin: 0; padding: 0;">
        <tbody>
          ${items.map((item) => {
            const qty = item.qty ?? item.quantity ?? 1;
            const price = Number(item.price || 0);
            const amount = Number(item.amount ?? (price * qty));
            const itemName = item.name || item.title || 'Item';
            return `
              <tr style="vertical-align: top;">
                <td colspan="3" style="text-align: left; font-weight: bold; font-size: 10px; word-break: break-word; padding: 2px 0 1px 0;">${itemName}</td>
              </tr>
              <tr style="vertical-align: top;">
                <td style="width: 20%; text-align: left; font-size: 10px; padding-bottom: 3px;">${formatVal(qty)}</td>
                <td style="width: 40%; text-align: center; font-size: 10px; padding-bottom: 3px;">${formatVal(price)}</td>
                <td style="width: 40%; text-align: right; font-size: 10px; padding-bottom: 3px;">${formatVal(amount)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <!-- 4. Totals Block (Right-Aligned 2-Column HTML Table) -->
      <hr style="${hrStyle}" />
      <table style="width: 100%; table-layout: fixed; border-collapse: collapse; margin: 0; padding: 0; font-size: 10px;">
        <tbody>
          <tr>
            <td style="text-align: left; padding: 1px 0;">Sub total :</td>
            <td style="text-align: right; padding: 1px 0;">${subtotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="text-align: left; padding: 1px 0;">CGST ${cgstRate.toFixed(1).replace(/\.0$/, '')}% :</td>
            <td style="text-align: right; padding: 1px 0;">${cgstAmount.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="text-align: left; padding: 1px 0;">SGST ${sgstRate.toFixed(1).replace(/\.0$/, '')}% :</td>
            <td style="text-align: right; padding: 1px 0;">${sgstAmount.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <hr style="${hrStyle}" />
      <table style="width: 100%; table-layout: fixed; border-collapse: collapse; margin: 0; padding: 0; font-size: 11px; font-weight: bold;">
        <tbody>
          <tr>
            <td style="text-align: left; padding: 1px 0;">Total :</td>
            <td style="text-align: right; padding: 1px 0;">${grandTotal.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
      <hr style="${hrStyle}" />

      <!-- 5. Footer Section (Centered) -->
      <div style="text-align: center; font-size: 10px; padding-top: 4px;">
        <div>Have a Sweet Day</div>
        <div>Visit Again.</div>
      </div>
    </div>
  `;
};

/**
 * Generate 58mm Thermal Plain Text Receipt (ESC/POS compatible, 32 chars wide)
 */
export const generateThermalReceiptText = (orderData = {}, settings = {}) => {
  const divider = '-'.repeat(32);

  const storeName = settings.storeName || orderData.storeName || 'Magixx Sweets & Cafe';
  let rawAddress = settings.address || orderData.address || 'Opposite of Kalyan Mandap, Joda, - 756121';
  if (!/^address:/i.test(rawAddress.trim())) {
    rawAddress = `Address: ${rawAddress.trim()}`;
  }
  const gstinVal = settings.gstin || orderData.gstin || '21ATDPK9131G1Z1';
  const phoneVal = settings.phone || orderData.phone || '7001322855';

  const gstinText = `GSTIN - ${gstinVal}`;
  const phoneText = `Phone - ${phoneVal}`;

  const headerLines = [
    ...wrapAndCenterText(storeName, 32),
    ...wrapAndCenterText(rawAddress, 32),
    ...wrapAndCenterText(gstinText, 32),
    ...wrapAndCenterText(phoneText, 32),
    divider,
    centerText('INVOICE', 32),
    divider,
  ];

  const invoiceNo = orderData.invoiceNo || orderData.orderId || (orderData.tokenNumber ? `ORD-${orderData.tokenNumber}` : `ORD-${Date.now().toString().slice(-6)}`);
  const dateTime = orderData.dateTime || orderData.date || `${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  const orderType = orderData.orderType || orderData.type || 'Dine-in';
  const payMethod = orderData.paymentMethod || orderData.pay || orderData.method || 'Cash';

  const orderInfoLines = [
    `Invoice No - ${invoiceNo}`.slice(0, 32),
    `Date/time - ${dateTime}`.slice(0, 32),
    `Type - ${orderType}`.slice(0, 32),
    `Pay - ${payMethod}`.slice(0, 32),
    divider,
  ];

  const itemHeaderLines = [
    'Item Name',
    build32CharLine('Qty.', 'Price', 'Amount', 32),
    divider,
  ];

  const items = orderData.items || orderData.cart || [];
  const itemDataLines = [];

  items.forEach((item) => {
    const itemName = String(item.name || item.title || 'Item').trim();
    const qty = item.qty ?? item.quantity ?? 1;
    const price = Number(item.price || 0);
    const amount = Number(item.amount ?? (price * qty));

    const qtyStr = Number.isInteger(Number(qty)) ? String(qty) : Number(qty).toFixed(2);
    const priceStr = Number.isInteger(price) ? String(price) : price.toFixed(2);
    const amtStr = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);

    itemDataLines.push(itemName);
    itemDataLines.push(build32CharLine(qtyStr, priceStr, amtStr, 32));
  });

  const subtotal = Number(orderData.subtotal ?? items.reduce((sum, i) => sum + (Number(i.price || 0) * Number(i.qty || 1)), 0));
  const taxRate = Number(settings.taxRate || orderData.taxRate || 5);
  const cgstRate = taxRate / 2;
  const sgstRate = taxRate / 2;

  const cgstAmount = Number(orderData.cgstAmount ?? ((subtotal * cgstRate) / 100));
  const sgstAmount = Number(orderData.sgstAmount ?? ((subtotal * sgstRate) / 100));
  const grandTotal = Number(orderData.total ?? orderData.grandTotal ?? (subtotal + cgstAmount + sgstAmount));

  const totalsLines = [
    divider,
    formatTotalRow('Sub total :', subtotal, 32),
    formatTotalRow(`CGST ${cgstRate.toFixed(1).replace(/\.0$/, '')}% :`, cgstAmount, 32),
    formatTotalRow(`SGST ${sgstRate.toFixed(1).replace(/\.0$/, '')}% :`, sgstAmount, 32),
    divider,
    formatTotalRow('Total :', grandTotal, 32),
    divider,
  ];

  const footerLines = [
    centerText('Have a Sweet Day', 32),
    centerText('Visit Again.', 32),
  ];

  return [
    ...headerLines,
    ...orderInfoLines,
    ...itemHeaderLines,
    ...itemDataLines,
    ...totalsLines,
    ...footerLines,
  ].join('\n');
};
