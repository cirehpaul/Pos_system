import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, QrCode, Download, CheckCircle2, XCircle, Sparkles, Check } from 'lucide-react';
import { generateQRDataURL } from '../../utils/qrGenerator';
import './GuestPassScreen.css';

export default function GuestPassScreen() {
  const [params] = useSearchParams();
  const [qrDataURL, setQrDataURL] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  // Extract pass data from URL params with full character cleanup
  const rawLoc = params.get('loc') || 'VIP Table';
  const rawTime = params.get('time') || 'Event Night';
  const cleanLoc = rawLoc.replace(/Â·/g, '·').replace(/Â/g, '');
  const cleanTime = rawTime.replace(/Â·/g, '·').replace(/Â/g, '');

  const slip = {
    reservationNumber: params.get('ref') || 'N/A',
    clientName: params.get('name') || 'Valued Guest',
    locationName: cleanLoc,
    pax: params.get('pax') || '1',
    timeSlot: cleanTime,
    paidAmount: parseFloat(params.get('paid') || '0'),
    paymentCategory: params.get('method') || 'cash',
    cashierName: params.get('cashier') || 'Staff',
    createdAt: params.get('date') || String(Date.now()),
  };

  const isValid = !!params.get('ref');

  // Generate QR image asynchronously
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const currentURL = window.location.href;
        const dataURL = await generateQRDataURL(currentURL, 220, '#000000', '#ffffff');
        if (active) setQrDataURL(dataURL);
      } catch (e) {
        console.error('Guest pass QR generation error', e);
      }
    })();
    return () => { active = false; };
  }, []);

  const formatCurrency = (v) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v);

  const handleSaveImage = async () => {
    setDownloading(true);
    try {
      const { downloadTicketPassImage } = await import('../../utils/ticketDownloader');
      await downloadTicketPassImage(slip);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 3500);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  if (!isValid) {
    return (
      <div className="gp-root gp-invalid">
        <XCircle size={56} color="#f87171" />
        <h2>Invalid Pass</h2>
        <p>This link or QR code does not contain a valid Lucid event pass.</p>
      </div>
    );
  }

  return (
    <div className="gp-root">
      {/* Ambient background glow */}
      <div className="gp-bg-glow" />

      {/* Top Quick Download Banner (Mobile UX) */}
      <div className="gp-top-banner animate-fade-in">
        <div className="gp-top-banner-info">
          <span className="gp-top-badge">
            <Sparkles size={11} /> VIP Pass Ready
          </span>
          <span className="gp-top-title">Tap button to save soft copy to device</span>
        </div>
        <button
          type="button"
          className={`gp-top-dl-btn ${downloaded ? 'gp-top-dl-btn--done' : ''}`}
          onClick={handleSaveImage}
          disabled={downloading}
        >
          {downloaded ? (
            <>
              <Check size={16} /> Saved!
            </>
          ) : downloading ? (
            <span>Saving...</span>
          ) : (
            <>
              <Download size={16} /> Save Pass
            </>
          )}
        </button>
      </div>

      <div className="gp-card">

        {/* Header brand */}
        <div className="gp-header">
          <img src="/LUCID.png" alt="Lucid" className="gp-logo" />
          <div className="gp-badge">
            <ShieldCheck size={12} />
            <span>OFFICIAL VIP EVENT PASS</span>
          </div>
          <h1 className="gp-location">{slip.locationName}</h1>
          <div className="gp-ref">PASS #{slip.reservationNumber}</div>
        </div>

        {/* Valid Pass Status Pill (Clean Context - No Time/Expiry Countdown) */}
        <div className="gp-status">
          <CheckCircle2 size={18} />
          <span>CONFIRMED & VALID PASS · ADMIT {slip.pax}</span>
        </div>

        {/* Primary Download Button directly above details for instant access */}
        <button
          type="button"
          className={`gp-download-btn gp-download-btn--top ${downloaded ? 'gp-download-btn--done' : ''}`}
          onClick={handleSaveImage}
          disabled={downloading}
        >
          {downloaded ? (
            <>
              <Check size={18} />
              <span>Ticket Soft Copy Saved to Photos!</span>
            </>
          ) : (
            <>
              <Download size={18} />
              <span>{downloading ? 'Generating Soft Copy...' : 'Download Soft Copy (PNG)'}</span>
            </>
          )}
        </button>

        {/* Perforation */}
        <div className="gp-perforation" />

        {/* Guest details */}
        <div className="gp-grid">
          <div className="gp-detail">
            <span className="gp-detail-label">GUEST / CLIENT</span>
            <span className="gp-detail-val gp-detail-val--name">{slip.clientName}</span>
          </div>
          <div className="gp-detail">
            <span className="gp-detail-label">CAPACITY & ADMISSION</span>
            <span className="gp-detail-val">{slip.pax} Guests (Consumable)</span>
          </div>
          <div className="gp-detail gp-detail--wide">
            <span className="gp-detail-label">SESSION / TIME</span>
            <span className="gp-detail-val">{slip.timeSlot}</span>
          </div>
        </div>

        {/* Settlement */}
        <div className="gp-settlement">
          <div>
            <div className="gp-settlement-label">PAYMENT METHOD</div>
            <div className="gp-settlement-method">
              {(slip.paymentCategory || 'CASH').replace('_', ' ').toUpperCase()}
            </div>
            <div className="gp-settlement-cashier">Issued by {slip.cashierName}</div>
          </div>
          <div className="gp-settlement-amount-col">
            <div className="gp-settlement-label">TOTAL SETTLED</div>
            <div className="gp-settlement-amount">{formatCurrency(slip.paidAmount)}</div>
            <div className="gp-paid-pill">PAID</div>
          </div>
        </div>

        {/* Perforation */}
        <div className="gp-perforation" />

        {/* Self QR code box */}
        <div className="gp-qr-row">
          <div className="gp-qr-box">
            {qrDataURL ? (
              <img src={qrDataURL} alt="Pass QR" className="gp-qr-img" />
            ) : (
              <div className="gp-qr-placeholder">
                <QrCode size={36} color="#64748b" />
                <span>Loading QR...</span>
              </div>
            )}
          </div>
          <div className="gp-qr-hint">
            <QrCode size={14} />
            <span>Present QR code upon entrance verification</span>
          </div>
        </div>

        {/* Watermark */}
        <div className="gp-watermark">EXCLUSIVE ACCESS · NON-TRANSFERABLE · LUCID</div>

        {/* Bottom Download button */}
        <button
          type="button"
          className={`gp-download-btn ${downloaded ? 'gp-download-btn--done' : ''}`}
          onClick={handleSaveImage}
          disabled={downloading}
        >
          {downloaded ? (
            <>
              <Check size={18} />
              <span>Ticket Saved Successfully!</span>
            </>
          ) : (
            <>
              <Download size={18} />
              <span>Download Soft Copy (PNG)</span>
            </>
          )}
        </button>
      </div>

      <p className="gp-footer-note">
        This digital pass was issued by Lucid.<br />
        Present upon entrance. Valid for event admission.
      </p>
    </div>
  );
}
