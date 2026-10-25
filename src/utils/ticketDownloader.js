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
