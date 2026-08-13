/**
 * receiptGenerator.js
 * 58mm Thermal Receipt Plain Text & HTML Generator
 * Strictly matches 5-section sketch specification for 32-character fixed width receipts.
 */

/**
 * Centering helper for fixed width (32 chars default).
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
 * Used for Line 2 of Item Header ("Qty.", "Price", "Amount") and Data Rows (qty, price, amount).
 */
export const build32CharLine = (leftStr, centerStr, rightStr, width = 32) => {
  const left = String(leftStr ?? '');
  const center = String(centerStr ?? '');
  const right = String(rightStr ?? '');

  const lineArr = new Array(width).fill(' ');

  // Left aligned starting at index 0
  for (let i = 0; i < left.length && i < width; i++) {
    lineArr[i] = left[i];
  }

  // Right aligned ending at width - 1
  const rightStart = width - right.length;
  for (let i = 0; i < right.length && (rightStart + i) < width; i++) {
    if (rightStart + i >= 0) {
      lineArr[rightStart + i] = right[i];
    }
  }

  // Center aligned around Math.floor((width - center.length) / 2)
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
 * Format total row (Label left-aligned, Amount right-aligned within 32 chars).
 */
export const formatTotalRow = (label, value, width = 32) => {
  const valStr = typeof value === 'number' ? value.toFixed(2) : String(value ?? '0.00');
  const lblStr = String(label ?? '');
  const availableSpace = width - valStr.length;
  const paddedLabel = lblStr.padEnd(Math.max(0, availableSpace));
  return `${paddedLabel}${valStr}`.slice(0, width);
};

/**
 * Generate 58mm Thermal Plain Text Receipt (ESC/POS compatible, 32 chars wide)
 */
export const generateThermalReceiptText = (orderData = {}, settings = {}) => {
  const divider = '-'.repeat(32);

  // 1. Header Section (Centered)
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

  // 2. Order Information (Left-Aligned)
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

  // 3. Item List Structure (2-Line Row Layout)
  // Header Line
  const itemHeaderLines = [
    'Item Name',
    build32CharLine('Qty.', 'Price', 'Amount', 32),
    divider,
  ];

  // Data Rows
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

    // Line 1: Full Item Name
    itemDataLines.push(itemName);

    // Line 2: Qty (left), Price (centered), Amount (right)
    itemDataLines.push(build32CharLine(qtyStr, priceStr, amtStr, 32));
  });

  // 4. Totals Block (Left/Right Aligned)
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

  // 5. Footer Section (Centered)
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

/**
 * Generate 58mm Thermal HTML Receipt Layout strictly matching the sketch structure.
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

  return `
    <div class="thermal-receipt-container text-black font-mono text-[11px] leading-tight w-[48mm] max-w-[48mm] mx-auto py-1 space-y-1">
      <!-- 1. Header Section (Centered) -->
      <div class="text-center">
        <div class="font-bold text-xs uppercase">${storeName}</div>
        <div class="text-[10px] break-words">${rawAddress}</div>
        <div class="text-[10px]">GSTIN - ${gstinVal}</div>
        <div class="text-[10px]">Phone - ${phoneVal}</div>
        <div class="border-b border-dashed border-black my-1"></div>
        <div class="font-bold text-xs tracking-wider">INVOICE</div>
        <div class="border-b border-dashed border-black my-1"></div>
      </div>

      <!-- 2. Order Information (Left-Aligned) -->
      <div class="text-left text-[10px] space-y-0.5">
        <div>Invoice No - ${invoiceNo}</div>
        <div>Date/time - ${dateTime}</div>
        <div>Type - ${orderType}</div>
        <div>Pay - ${payMethod}</div>
        <div class="border-b border-dashed border-black my-1"></div>
      </div>

      <!-- 3. Item List Structure (2-Line Row Layout) -->
      <div class="text-left space-y-1">
        <!-- Header Line -->
        <div class="font-bold text-[10px]">
          <div>Item Name</div>
          <div class="flex justify-between items-center text-[10px]">
            <span class="w-1/3 text-left">Qty.</span>
            <span class="w-1/3 text-center">Price</span>
            <span class="w-1/3 text-right">Amount</span>
          </div>
        </div>
        <div class="border-b border-dashed border-black my-1"></div>

        <!-- Data Rows (2 Lines per Item) -->
        ${items.map((item) => {
          const qty = item.qty ?? item.quantity ?? 1;
          const price = Number(item.price || 0);
          const amount = Number(item.amount ?? (price * qty));
          return `
            <div class="text-[10px] space-y-0.5">
              <div class="font-bold break-words">${item.name || item.title || 'Item'}</div>
              <div class="flex justify-between items-center text-[10px]">
                <span class="w-1/3 text-left">${formatVal(qty)}</span>
                <span class="w-1/3 text-center">${formatVal(price)}</span>
                <span class="w-1/3 text-right">${formatVal(amount)}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- 4. Totals Block (Left/Right Aligned) -->
      <div class="text-[10px] space-y-0.5">
        <div class="border-b border-dashed border-black my-1"></div>
        <div class="flex justify-between">
          <span>Sub total :</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        <div class="flex justify-between">
          <span>CGST ${cgstRate.toFixed(1).replace(/\.0$/, '')}% :</span>
          <span>${cgstAmount.toFixed(2)}</span>
        </div>
        <div class="flex justify-between">
          <span>SGST ${sgstRate.toFixed(1).replace(/\.0$/, '')}% :</span>
          <span>${sgstAmount.toFixed(2)}</span>
        </div>
        <div class="border-b border-dashed border-black my-1"></div>
        <div class="flex justify-between font-bold text-xs">
          <span>Total :</span>
          <span>${grandTotal.toFixed(2)}</span>
        </div>
        <div class="border-b border-dashed border-black my-1"></div>
      </div>

      <!-- 5. Footer Section (Centered) -->
      <div class="text-center text-[10px] pt-1">
        <div>Have a Sweet Day</div>
        <div>Visit Again.</div>
      </div>
    </div>
  `;
};
