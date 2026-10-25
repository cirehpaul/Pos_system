import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, Clock, QrCode, Download, CheckCircle2, XCircle, Timer } from 'lucide-react';
import { generateQRDataURL } from '../../utils/qrGenerator';
import './GuestPassScreen.css';

export default function GuestPassScreen() {
  const [params] = useSearchParams();
  const [timeLeft, setTimeLeft] = useState('');
  const [expired, setExpired] = useState(false);
  const [qrDataURL, setQrDataURL] = useState(null);

  // Extract pass data from URL params
  const slip = {
    reservationNumber: params.get('ref') || 'N/A',
    clientName: params.get('name') || 'Valued Guest',
    locationName: params.get('loc') || 'VIP Table',
    pax: params.get('pax') || '1',
    timeSlot: params.get('time') || 'Event Night',
    paidAmount: parseFloat(params.get('paid') || '0'),
    paymentCategory: params.get('method') || 'cash',
    cashierName: params.get('cashier') || 'Staff',
    createdAt: params.get('date') || new Date().toISOString(),
  };

  const isValid = !!params.get('ref');
  const createdAt = new Date(slip.createdAt).getTime();
  const expiresAt = createdAt + 24 * 60 * 60 * 1000;

  // Generate self-referential QR (so guests can share or bookmark)
  useEffect(() => {
    try {
      const currentURL = window.location.href;
      const dataURL = generateQRDataURL(currentURL, 140);
      setQrDataURL(dataURL);
    } catch (e) {
      console.error('Guest pass QR generation error', e);
    }
  }, []);

  // 24hr countdown
  useEffect(() => {
    function tick() {
      const now = Date.now();
      const diff = expiresAt - now;
      if (diff <= 0) {
        setExpired(true);
        setTimeLeft('EXPIRED');
        return;
      }
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    }
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [expiresAt]);

  const expiresDate = new Date(expiresAt);
  const expiresStr = expiresDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' at ' + expiresDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const formatCurrency = (v) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v);

  const handleSaveImage = () => {
    import('../../utils/ticketDownloader').then(({ downloadTicketPassImage }) => {
      downloadTicketPassImage(slip);
    });
  };

  if (!isValid) {
    return (
      <div className="gp-root gp-invalid">
        <XCircle size={56} color="#f87171" />
        <h2>Invalid Pass</h2>
        <p>This QR code does not contain a valid Lucid event pass.</p>
      </div>
    );
  }

  return (
    <div className="gp-root">
      {/* Animated background */}
      <div className="gp-bg-glow" />

      <div className={`gp-card${expired ? ' gp-card--expired' : ''}`}>

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

        {/* Validity status */}
        <div className={`gp-status${expired ? ' gp-status--expired' : ''}`}>
          {expired ? (
            <>
              <XCircle size={18} />
              <span>This pass has expired and is no longer valid</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={18} />
              <span>ACTIVE PASS &nbsp;·&nbsp; Valid until {expiresStr}</span>
            </>
          )}
        </div>

        {/* Countdown timer */}
        {!expired && (
          <div className="gp-countdown-box">
            <Timer size={14} />
            <span className="gp-countdown-label">Time Remaining</span>
            <span className="gp-countdown">{timeLeft}</span>
          </div>
        )}

        {/* Perforation */}
        <div className="gp-perforation" />

        {/* Guest details */}
        <div className="gp-grid">
          <div className="gp-detail">
            <span className="gp-detail-label">GUEST / CLIENT</span>
            <span className="gp-detail-val gp-detail-val--name">{slip.clientName}</span>
          </div>
          <div className="gp-detail">
            <span className="gp-detail-label">CAPACITY</span>
            <span className="gp-detail-val">{slip.pax} Guests</span>
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
              {slip.paymentCategory.replace('_', ' ').toUpperCase()}
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

        {/* Self QR code */}
        {qrDataURL && (
          <div className="gp-qr-row">
            <div className="gp-qr-box">
              <img src={qrDataURL} alt="Pass QR" className="gp-qr-img" />
            </div>
            <div className="gp-qr-hint">
              <QrCode size={14} />
              <span>Share or save this page for re-entry</span>
            </div>
          </div>
        )}

        {/* Watermark */}
        <div className="gp-watermark">EXCLUSIVE ACCESS · NON-TRANSFERABLE · LUCID</div>

        {/* Download button */}
        {!expired && (
          <button className="gp-download-btn" onClick={handleSaveImage}>
            <Download size={18} />
            <span>Download Digital Copy (PNG)</span>
          </button>
        )}
      </div>

      <p className="gp-footer-note">
        This digital pass was issued by Lucid POS System.<br />
        Present upon entrance. Valid for 24 hours from time of issue.
      </p>
    </div>
  );
}
