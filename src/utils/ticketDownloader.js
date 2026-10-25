/**
 * Ticket Soft Copy Generator & Downloader
 * Renders a high-resolution (800x1300) VIP Event Pass onto an offscreen canvas
 * and triggers a clean PNG download for guests/cashier.
 */
import { generateQRDataURL } from './qrGenerator';

export async function downloadTicketPassImage(slip) {
  if (!slip) return;

  const width = 800;
  const height = 1320;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // 1. Dark Luxury Background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#0d1322');
  bgGrad.addColorStop(0.5, '#070a13');
  bgGrad.addColorStop(1, '#020409');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Outer Gold Glow & Border
  ctx.save();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
  ctx.lineWidth = 4;
  roundRect(ctx, 20, 20, width - 40, height - 40, 28);
  ctx.stroke();
  ctx.restore();

  // Side Notches (physical ticket look)
  ctx.fillStyle = '#020409';
  ctx.beginPath();
  ctx.arc(20, 360, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(width - 20, 360, 26, 0, Math.PI * 2);
  ctx.fill();

  // Notch border arcs
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(20, 360, 26, -Math.PI / 2, Math.PI / 2, false);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(width - 20, 360, 26, Math.PI / 2, (3 * Math.PI) / 2, false);
  ctx.stroke();

  // 2. Draw Brand Logo
  try {
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    logoImg.src = '/LUCID.png';
    await new Promise((resolve) => {
      logoImg.onload = resolve;
      logoImg.onerror = resolve; // Continue even if logo fails
      setTimeout(resolve, 600); // 600ms timeout
    });
    if (logoImg.complete && logoImg.naturalWidth > 0) {
      const logoH = 64;
      const logoW = (logoImg.naturalWidth / logoImg.naturalHeight) * logoH;
      ctx.drawImage(logoImg, (width - logoW) / 2, 50, logoW, logoH);
    }
  } catch (e) {
    console.warn('Canvas logo load bypassed', e);
  }

  // 3. Official Gold Pill Badge
  ctx.save();
  const badgeText = 'OFFICIAL VIP EVENT PASS & RECEIPT';
  ctx.font = '900 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const badgeW = ctx.measureText(badgeText).width + 36;
  const badgeX = (width - badgeW) / 2;
  const badgeY = 135;

  const badgeGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY + 34);
  badgeGrad.addColorStop(0, '#f59e0b');
  badgeGrad.addColorStop(1, '#d97706');
  ctx.fillStyle = badgeGrad;
  roundRect(ctx, badgeX, badgeY, badgeW, 34, 17);
  ctx.fill();

  ctx.fillStyle = '#05070d';
  ctx.textAlign = 'center';
  ctx.fillText(badgeText, width / 2, badgeY + 22);
  ctx.restore();

  // 4. Location / Table Title
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const cleanLocation = (slip.locationName || 'VIP Reservation').replace(/Â·/g, '·').replace(/Â/g, '');
  const cleanTimeSlot = (slip.timeSlot || 'Event Night').replace(/Â·/g, '·').replace(/Â/g, '');

  // 4. Location / Table Title
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(cleanLocation, width / 2, 215);

  // 5. Monospace Reference Bar
  ctx.fillStyle = '#fbbf24';
  ctx.font = '700 18px monospace';
  const parsedDate = slip.createdAt ? (!isNaN(slip.createdAt) ? new Date(Number(slip.createdAt)) : new Date(slip.createdAt)) : new Date();
  const safeDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  const passDate = safeDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  ctx.fillText(`PASS #${slip.reservationNumber || '0000'}  •  ${passDate}`, width / 2, 252);

  // 6. Official Admission Tag (Clean context, no time countdown)
  ctx.save();
  const validStr = 'OFFICIAL VIP PASS • CONFIRMED ADMISSION';
  ctx.font = '800 13px -apple-system, BlinkMacSystemFont, sans-serif';
  const validW = ctx.measureText(validStr).width + 30;
  ctx.fillStyle = 'rgba(245, 158, 11, 0.16)';
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, (width - validW) / 2, 275, validW, 30, 15);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fbbf24';
  ctx.textAlign = 'center';
  ctx.fillText(validStr, width / 2, 295);
  ctx.restore();

  // 7. Dashed Perforation Line
  drawDashedLine(ctx, 40, 360, width - 40, 360, [8, 8]);

  // 8. 2x2 Details Grid Cards
  const cardX1 = 50;
  const cardX2 = width / 2 + 10;
  const cardW = width / 2 - 60;
  const cardH = 92;

  drawDetailCard(ctx, cardX1, 390, cardW, cardH, 'GUEST / CLIENT', slip.clientName || 'Valued Guest');
  drawDetailCard(ctx, cardX2, 390, cardW, cardH, 'CONTACT', slip.clientContact || 'None provided');
  drawDetailCard(ctx, cardX1, 495, cardW, cardH, 'CAPACITY & ADMISSION', `${slip.pax || 1} Guests (Consumable)`);
  drawDetailCard(ctx, cardX2, 495, cardW, cardH, 'SESSION / TIME', cleanTimeSlot);

  // 9. Settlement Highlight Banner
  ctx.save();
  const settleY = 610;
  const settleH = 110;
  const settleW = width - 100;
  const settleGrad = ctx.createLinearGradient(50, settleY, width - 50, settleY + settleH);
  settleGrad.addColorStop(0, 'rgba(245, 158, 11, 0.14)');
  settleGrad.addColorStop(1, 'rgba(16, 185, 129, 0.12)');
  ctx.fillStyle = settleGrad;
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
  ctx.lineWidth = 2;
  roundRect(ctx, 50, settleY, settleW, settleH, 18);
  ctx.fill();
  ctx.stroke();

  // Settlement labels
  ctx.fillStyle = '#fbbf24';
  ctx.font = '800 13px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PAYMENT METHOD', 74, settleY + 36);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 22px -apple-system, sans-serif';
  ctx.fillText((slip.paymentCategory || 'CASH').replace('_', ' ').toUpperCase(), 74, settleY + 68);

  if (slip.paymentDetails?.reference) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 13px monospace';
    ctx.fillText(`Ref: ${slip.paymentDetails.reference}`, 74, settleY + 92);
  }

  // Settlement amount (right side)
  ctx.fillStyle = '#94a3b8';
  ctx.font = '800 13px -apple-system, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('TOTAL SETTLED', width - 74, settleY + 36);

  ctx.fillStyle = '#34d399';
  ctx.font = '900 34px monospace';
  const formattedAmt = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(slip.paidAmount || 0);
  ctx.fillText(formattedAmt, width - 74, settleY + 76);
  ctx.restore();

  // Cashier & Status Row
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 15px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Issued by: ${slip.cashierName || 'Staff'}`, 54, 755);

  // PAID & CONFIRMED pill
  ctx.save();
  const paidText = 'PAID & CONFIRMED';
  ctx.font = '900 12px -apple-system, sans-serif';
  const paidW = ctx.measureText(paidText).width + 24;
  ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, width - 50 - paidW, 736, paidW, 26, 13);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#34d399';
  ctx.textAlign = 'center';
  ctx.fillText(paidText, width - 50 - paidW / 2, 753);
  ctx.restore();

  // 10. Dashed Perforation Line before QR
  drawDashedLine(ctx, 40, 785, width - 40, 785, [8, 8]);

  // 11. Scannable QR Code Box
  const qrBoxY = 810;
  const qrBoxSize = 250;
  const qrBoxX = (width - qrBoxSize) / 2;

  // White Card for crisp QR contrast
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 20;
  roundRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 20);
  ctx.fill();
  ctx.shadowBlur = 0; // reset shadow

  // Generate high-resolution scannable QR Code image into the box
  try {
    const qrTargetUrl = getPassURL(slip);
    const qrDataURL = await generateQRDataURL(qrTargetUrl, 320, '#000000', '#ffffff');
    const qrImg = new Image();
    qrImg.src = qrDataURL;
    await new Promise((resolve) => {
      qrImg.onload = resolve;
      qrImg.onerror = resolve;
      setTimeout(resolve, 600);
    });
    if (qrImg.complete && qrImg.naturalWidth > 0) {
      const qrPad = 14;
      ctx.drawImage(qrImg, qrBoxX + qrPad, qrBoxY + qrPad, qrBoxSize - qrPad * 2, qrBoxSize - qrPad * 2);
    }
  } catch (err) {
    console.error('Canvas QR rendering error:', err);
  }

  // QR Code Subtitle
  ctx.fillStyle = '#fbbf24';
  ctx.font = '800 15px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SCAN WITH PHONE FOR DIGITAL PASS & SOFT COPY', width / 2, qrBoxY + qrBoxSize + 32);

  // Monospace Pass Code
  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 16px monospace';
  ctx.fillText(`#${slip.reservationNumber || 'RES-0000'}`, width / 2, qrBoxY + qrBoxSize + 56);

  // 12. Security Camera Notice & Watermark
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 14px -apple-system, sans-serif';
  ctx.fillText('📷 Guest may save or present this digital pass upon VIP entrance', width / 2, qrBoxY + qrBoxSize + 88);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.font = '900 12px -apple-system, sans-serif';
  ctx.fillText('EXCLUSIVE ACCESS  •  NON-TRANSFERABLE  •  LUCID POS', width / 2, qrBoxY + qrBoxSize + 114);

  // 13. Trigger File Download
  const fileName = `Lucid-VIP-Pass-${slip.reservationNumber || 'Event'}.png`;
  const dataURL = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataURL;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  return dataURL;
}

/**
 * Builds the sharable / scannable URL encoded with pass details
 */
export function getPassURL(slip) {
  if (!slip) return window.location.origin;

  let origin = window.location.origin;
  // If running locally in development, prefer LAN IP so phones on same Wi-Fi can open it
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    const customHost = localStorage.getItem('lucid_network_host') || '192.168.1.8';
    origin = `${window.location.protocol}//${customHost}:${window.location.port || '5173'}`;
  }

  const parsedDate = slip.createdAt ? (!isNaN(slip.createdAt) ? new Date(Number(slip.createdAt)) : new Date(slip.createdAt)) : new Date();
  const safeDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  const createdTime = safeDate.getTime();
  const cleanTime = (slip.timeSlot || 'Event Night').replace(/Â·/g, '·').replace(/Â/g, '');
  const cleanLoc = (slip.locationName || 'VIP Table').replace(/Â·/g, '·').replace(/Â/g, '');

  const params = new URLSearchParams({
    ref: slip.reservationNumber || '',
    name: slip.clientName || '',
    loc: cleanLoc,
    pax: String(slip.pax || 1),
    time: cleanTime,
    paid: String(slip.paidAmount || 0),
    method: slip.paymentCategory || '',
    date: String(createdTime),
    cashier: slip.cashierName || ''
  });

  return `${origin}/guest-pass?${params.toString()}`;
}

// Canvas Helpers
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawDashedLine(ctx, x1, y1, x2, y2, pattern) {
  ctx.save();
  ctx.setLineDash(pattern);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function drawDetailCard(ctx, x, y, w, h, label, value) {
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.stroke();

  // Label
  ctx.fillStyle = '#94a3b8';
  ctx.font = '800 12px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 16, y + 28);

  // Value
  ctx.fillStyle = '#f8fafc';
  ctx.font = '800 18px -apple-system, sans-serif';
  // Truncate if too long
  let displayVal = value;
  if (ctx.measureText(displayVal).width > w - 32) {
    while (displayVal.length > 3 && ctx.measureText(displayVal + '...').width > w - 32) {
      displayVal = displayVal.slice(0, -1);
    }
    displayVal += '...';
  }
  ctx.fillText(displayVal, x + 16, y + 62);
  ctx.restore();
}


/**
 * Walk-in Admission Ticket Pass Generator
 * Renders a premium dark-luxury canvas PNG identical in style to the VIP pass,
 * branded as an "Admission Ticket Pass" for walk-in customers.
 *
 * @param {Object} order - The completed order object from PaymentModal
 * @returns {string} dataURL - Base64 PNG data URL
 */
export async function downloadWalkinTicketImage(order) {
  if (!order) return;

  const ticketQty = (order.items || [])
    .filter(i => (i.name || '').toLowerCase().includes('admission'))
    .reduce((sum, i) => sum + (i.quantity || 1), 0) || 1;

  const seatingTable = order.assignedTable ||
    (order.items || []).find(i => i.assignedTable)?.assignedTable ||
    (order.items || []).find(i => i.name && i.name.includes('Round Table'))?.name?.replace(/Admission Ticket.*?\(|\)/g, '') ||
    'Available: Round Tables 1-34 (Poolside)';

  const width = 800;
  const height = 1380;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // 1. Dark Luxury Obsidian Background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#090d16');
  bgGrad.addColorStop(0.3, '#050811');
  bgGrad.addColorStop(0.7, '#04060d');
  bgGrad.addColorStop(1, '#020308');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle radial ambient glow behind header
  const radialGlow = ctx.createRadialGradient(width / 2, 160, 20, width / 2, 160, 320);
  radialGlow.addColorStop(0, 'rgba(245, 158, 11, 0.08)');
  radialGlow.addColorStop(0.6, 'rgba(56, 189, 248, 0.03)');
  radialGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = radialGlow;
  ctx.fillRect(0, 0, width, 400);

  // 2. Dual Metallic Gold Border & Corner Accents
  ctx.save();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
  ctx.lineWidth = 3.5;
  roundRect(ctx, 22, 22, width - 44, height - 44, 28);
  ctx.stroke();

  // Inset hairline border
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.16)';
  ctx.lineWidth = 1.2;
  roundRect(ctx, 30, 30, width - 60, height - 60, 22);
  ctx.stroke();

  // Corner Gold Bracket Accents
  drawCornerAccents(ctx, 22, 22, width - 44, height - 44, 24, '#fbbf24');
  ctx.restore();

  // Physical Ticket Side Cutouts
  drawTicketNotches(ctx, width, 370, 24);
  drawTicketNotches(ctx, width, 840, 24);

  // 3. Draw Brand Logo
  try {
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    logoImg.src = '/LUCID.png';
    await new Promise((resolve) => {
      logoImg.onload = resolve;
      logoImg.onerror = resolve;
      setTimeout(resolve, 600);
    });
    if (logoImg.complete && logoImg.naturalWidth > 0) {
      const logoH = 68;
      const logoW = (logoImg.naturalWidth / logoImg.naturalHeight) * logoH;
      ctx.drawImage(logoImg, (width - logoW) / 2, 50, logoW, logoH);
    }
  } catch (e) {
    console.warn('Canvas logo bypassed', e);
  }

  // 4. Gold Pill Badge: OFFICIAL ADMISSION TICKET PASS
  ctx.save();
  const badgeText = '✦ OFFICIAL ADMISSION EVENT PASS ✦';
  ctx.font = '900 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const badgeW = ctx.measureText(badgeText).width + 36;
  const badgeX = (width - badgeW) / 2;
  const badgeY = 136;

  const badgeGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY + 32);
  badgeGrad.addColorStop(0, '#f59e0b');
  badgeGrad.addColorStop(0.5, '#fbbf24');
  badgeGrad.addColorStop(1, '#d97706');
  ctx.fillStyle = badgeGrad;
  ctx.shadowColor = 'rgba(245, 158, 11, 0.35)';
  ctx.shadowBlur = 12;
  roundRect(ctx, badgeX, badgeY, badgeW, 32, 16);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#05070d';
  ctx.textAlign = 'center';
  ctx.fillText(badgeText, width / 2, badgeY + 21);
  ctx.restore();

  // 5. Title & Tagline
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 38px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 10;
  ctx.fillText('ADMISSION TICKET', width / 2, 214);
  ctx.shadowBlur = 0;

  // 6. Monospace Reference Bar
  ctx.fillStyle = '#fbbf24';
  ctx.font = '700 17px monospace';
  const orderDate = order.createdAt ? new Date(order.createdAt) : new Date();
  const passDate = orderDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  ctx.fillText('ORDER #' + (order.orderNumber || '000000') + '  •  ' + passDate.toUpperCase(), width / 2, 248);

  // 7. Confirmed Admission Status Pill
  ctx.save();
  const validStr = 'CONFIRMED ADMISSION • WALK-IN EVENT PASS';
  ctx.font = '800 12.5px -apple-system, BlinkMacSystemFont, sans-serif';
  const validW = ctx.measureText(validStr).width + 32;
  ctx.fillStyle = 'rgba(16, 185, 129, 0.14)';
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, (width - validW) / 2, 270, validW, 28, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#34d399';
  ctx.textAlign = 'center';
  ctx.fillText(validStr, width / 2, 289);
  ctx.restore();

  // 8. Dedicated Seating Callout Banner (Vibrant & Highlighted)
  ctx.save();
  const seatBoxY = 312;
  const seatBoxH = 46;
  const seatBoxW = width - 100;
  const seatBoxX = 50;
  const seatGrad = ctx.createLinearGradient(seatBoxX, seatBoxY, seatBoxX + seatBoxW, seatBoxY);
  seatGrad.addColorStop(0, 'rgba(56, 189, 248, 0.15)');
  seatGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.08)');
  seatGrad.addColorStop(1, 'rgba(245, 158, 11, 0.15)');
  ctx.fillStyle = seatGrad;
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, seatBoxX, seatBoxY, seatBoxW, seatBoxH, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = '800 12px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SEATING ASSIGNMENT', seatBoxX + 18, seatBoxY + 28);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 16px -apple-system, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(seatingTable, seatBoxX + seatBoxW - 18, seatBoxY + 29);
  ctx.restore();

  // Perforation Line
  drawDashedLine(ctx, 45, 370, width - 45, 370, [8, 8]);

  // 9. 2x2 Details Grid Cards
  const cardX1 = 50;
  const cardX2 = width / 2 + 10;
  const cardW = width / 2 - 60;
  const cardH = 90;

  drawDetailCard(ctx, cardX1, 395, cardW, cardH, 'GUEST / CLIENT', order.clientName || 'Walk-in Guest');
  drawDetailCard(ctx, cardX2, 395, cardW, cardH, 'CAPACITY & ADMISSION', ticketQty + ' Pax (₱550 / pass)');
  drawDetailCard(ctx, cardX1, 498, cardW, cardH, 'CASHIER / STAFF', order.cashierName || 'Staff');
  drawDetailCard(ctx, cardX2, 498, cardW, cardH, 'SESSION / VENUE', 'Event Night • Poolside');

  // 10. Settlement Highlight Banner
  ctx.save();
  const settleY = 608;
  const settleH = 108;
  const settleW = width - 100;
  const settleGrad = ctx.createLinearGradient(50, settleY, width - 50, settleY + settleH);
  settleGrad.addColorStop(0, 'rgba(245, 158, 11, 0.16)');
  settleGrad.addColorStop(1, 'rgba(16, 185, 129, 0.12)');
  ctx.fillStyle = settleGrad;
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
  ctx.lineWidth = 1.8;
  roundRect(ctx, 50, settleY, settleW, settleH, 18);
  ctx.fill();
  ctx.stroke();

  // Settlement labels
  ctx.fillStyle = '#fbbf24';
  ctx.font = '800 12.5px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PAYMENT METHOD', 74, settleY + 34);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 22px -apple-system, sans-serif';
  const methodLabel = (order.paymentCategory || order.paymentMethod || 'CASH').replace('_', ' ').toUpperCase();
  ctx.fillText(methodLabel, 74, settleY + 66);

  if (order.paymentReference && order.paymentReference !== 'N/A') {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 13px monospace';
    ctx.fillText('Ref: ' + order.paymentReference, 74, settleY + 90);
  }

  // Settlement amount (right side)
  ctx.fillStyle = '#94a3b8';
  ctx.font = '800 12.5px -apple-system, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('TOTAL SETTLED', width - 74, settleY + 34);

  ctx.fillStyle = '#34d399';
  ctx.font = '900 34px monospace';
  const formattedAmt = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(order.total || 0);
  ctx.fillText(formattedAmt, width - 74, settleY + 74);
  ctx.restore();

  // Cashier & Status Row
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 14px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Issued by: ' + (order.cashierName || 'Staff'), 54, 748);

  // PAID & CONFIRMED pill
  ctx.save();
  const paidText = 'PAID & CONFIRMED';
  ctx.font = '900 12px -apple-system, sans-serif';
  const paidW = ctx.measureText(paidText).width + 24;
  ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, width - 50 - paidW, 730, paidW, 26, 13);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#34d399';
  ctx.textAlign = 'center';
  ctx.fillText(paidText, width - 50 - paidW / 2, 747);
  ctx.restore();

  // 11. Realistic Barcode Graphic
  drawTicketBarcode(ctx, width / 2, 795, 340, 36, order.orderNumber || '000000');

  // Perforation Line before QR
  drawDashedLine(ctx, 45, 840, width - 45, 840, [8, 8]);

  // 12. Scannable QR Code Box with White Card Contrast
  const qrBoxY = 864;
  const qrBoxSize = 250;
  const qrBoxX = (width - qrBoxSize) / 2;

  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 24;
  roundRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 20);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Generate QR Code pointing to a guest pass URL
  try {
    const walkinSlip = {
      reservationNumber: order.orderNumber || 'ADM-0000',
      clientName: order.clientName || 'Walk-in Guest',
      locationName: 'Admission × ' + ticketQty + ' (' + seatingTable + ')',
      pax: ticketQty,
      timeSlot: 'Event Night',
      paidAmount: order.total || 0,
      paymentCategory: order.paymentCategory || order.paymentMethod || 'cash',
      cashierName: order.cashierName || 'Staff',
      createdAt: order.createdAt || new Date().toISOString()
    };
    const qrTargetUrl = getPassURL(walkinSlip);
    const qrDataURL = await generateQRDataURL(qrTargetUrl, 320, '#000000', '#ffffff');
    const qrImg = new Image();
    qrImg.src = qrDataURL;
    await new Promise((resolve) => {
      qrImg.onload = resolve;
      qrImg.onerror = resolve;
      setTimeout(resolve, 600);
    });
    if (qrImg.complete && qrImg.naturalWidth > 0) {
      const qrPad = 14;
      ctx.drawImage(qrImg, qrBoxX + qrPad, qrBoxY + qrPad, qrBoxSize - qrPad * 2, qrBoxSize - qrPad * 2);
    }
  } catch (err) {
    console.error('Canvas QR rendering error:', err);
  }

  // QR Code Subtitle
  ctx.fillStyle = '#fbbf24';
  ctx.font = '800 15px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SCAN WITH PHONE FOR DIGITAL PASS & SOFT COPY', width / 2, qrBoxY + qrBoxSize + 32);

  // Monospace Pass Code
  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 16px monospace';
  ctx.fillText('#' + (order.orderNumber || 'ADM-0000'), width / 2, qrBoxY + qrBoxSize + 56);

  // 13. Security Notice & Watermark
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 14px -apple-system, sans-serif';
  ctx.fillText('📷 Present this digital pass upon venue entrance', width / 2, qrBoxY + qrBoxSize + 88);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.font = '900 12px -apple-system, sans-serif';
  ctx.fillText('GENERAL ADMISSION  •  NON-TRANSFERABLE  •  LUCID POS', width / 2, qrBoxY + qrBoxSize + 114);

  // 14. Trigger File Download
  const fileName = 'Lucid-Admission-Pass-' + (order.orderNumber || 'Event') + '.png';
  const dataURL = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataURL;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  return dataURL;
}

// Helper: Corner Brackets
function drawCornerAccents(ctx, x, y, w, h, len, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;

  // Top-left
  ctx.beginPath();
  ctx.moveTo(x + 10, y + 10 + len);
  ctx.lineTo(x + 10, y + 10);
  ctx.lineTo(x + 10 + len, y + 10);
  ctx.stroke();

  // Top-right
  ctx.beginPath();
  ctx.moveTo(x + w - 10 - len, y + 10);
  ctx.lineTo(x + w - 10, y + 10);
  ctx.lineTo(x + w - 10, y + 10 + len);
  ctx.stroke();

  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(x + 10, y + h - 10 - len);
  ctx.lineTo(x + 10, y + h - 10);
  ctx.lineTo(x + 10 + len, y + h - 10);
  ctx.stroke();

  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(x + w - 10 - len, y + h - 10);
  ctx.lineTo(x + w - 10, y + h - 10);
  ctx.lineTo(x + w - 10, y + h - 10 - len);
  ctx.stroke();

  ctx.restore();
}

// Helper: Ticket side notches
function drawTicketNotches(ctx, width, y, r) {
  ctx.save();
  ctx.fillStyle = '#020308';
  ctx.beginPath();
  ctx.arc(22, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(width - 22, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(22, y, r, -Math.PI / 2, Math.PI / 2, false);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(width - 22, y, r, Math.PI / 2, (3 * Math.PI) / 2, false);
  ctx.stroke();
  ctx.restore();
}

// Helper: Ticket barcode graphic
function drawTicketBarcode(ctx, cx, cy, totalW, h, codeStr) {
  ctx.save();
  const startX = cx - totalW / 2;
  const barPattern = [
    2, 1, 3, 1, 2, 3, 1, 4, 1, 2, 3, 2, 1, 4, 2, 1, 3, 1, 2, 3, 1,
    4, 2, 1, 2, 3, 1, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 4, 1, 3, 2
  ];

  let currentX = startX;
  const totalPatternUnits = barPattern.reduce((a, b) => a + b, 0) + (barPattern.length - 1) * 2;
  const unitW = totalW / totalPatternUnits;

  ctx.fillStyle = '#94a3b8';
  for (let i = 0; i < barPattern.length; i++) {
    const barW = barPattern[i] * unitW;
    ctx.fillRect(currentX, cy, barW, h);
    currentX += barW + 2 * unitW;
  }

  ctx.fillStyle = '#64748b';
  ctx.font = '600 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('* ADM-' + codeStr + ' *', cx, cy + h + 14);
  ctx.restore();
}
