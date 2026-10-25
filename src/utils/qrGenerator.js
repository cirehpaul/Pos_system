/**
 * QR Code generator wrapper using the 'qrcode' npm library.
 * Generates ISO/IEC 18004 compliant, high-contrast, scannable QR codes.
 */
import QRCode from 'qrcode';

/**
 * Returns a canvas Data URL (PNG) for a QR code
 * Uses pure black (#000000) and white (#ffffff) with standard 4-module quiet zone margin
 * for 100% reliable camera scanning on iOS and Android.
 */
export async function generateQRDataURL(text, size = 260, fg = '#000000', bg = '#ffffff') {
  return await QRCode.toDataURL(text, {
    width: size,
    margin: 4,
    color: { dark: fg, light: bg },
    errorCorrectionLevel: 'M',
  });
}

/**
 * Returns an SVG string of a scannable QR code
 */
export async function generateQRSVG(text, size = 260, fg = '#000000', bg = '#ffffff') {
  return await QRCode.toString(text, {
    type: 'svg',
    width: size,
    margin: 4,
    color: { dark: fg, light: bg },
    errorCorrectionLevel: 'M',
  });
}

/**
 * Draws QR code directly onto a canvas context at (x, y) with specified size
 */
export async function drawQROnCanvas(text, targetCanvas, x, y, size, fg = '#000000', bg = '#ffffff') {
  const tempCanvas = document.createElement('canvas');
  await QRCode.toCanvas(tempCanvas, text, {
    width: size,
    margin: 4,
    color: { dark: fg, light: bg },
    errorCorrectionLevel: 'M',
  });
  const ctx = targetCanvas.getContext('2d');
  ctx.drawImage(tempCanvas, x, y, size, size);
}

/**
 * Returns a 2D matrix [row][col] (1 for dark, 0 for light)
 */
export function createQRMatrix(text) {
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const size = qr.modules.size;
    const matrix = [];
    for (let r = 0; r < size; r++) {
      const row = [];
      for (let c = 0; c < size; c++) {
        row.push(qr.modules.get(r, c) ? 1 : 0);
      }
      matrix.push(row);
    }
    return matrix;
  } catch (err) {
    console.error('createQRMatrix error:', err);
    return null;
  }
}
