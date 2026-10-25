import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Check, Users, MapPin, Sparkles, Clock, Phone, User,
  FileText, Banknote, Building2, Smartphone, ShieldCheck,
  Printer, ArrowRight, LayoutDashboard, Ban, UserCheck, Wine, Camera,
  Download, QrCode, Timer, ExternalLink, Copy
} from 'lucide-react';
import useReservationStore from '../../stores/reservationStore';
import useAuthStore from '../../stores/authStore';
import useCartStore from '../../stores/cartStore';
import { useToast } from '../../components/Toast/Toast';
import { formatCurrency } from '../../db/database';
import { generateQRDataURL } from '../../utils/qrGenerator';
import { downloadTicketPassImage, getPassURL } from '../../utils/ticketDownloader';
import './ReservationModal.css';

const BANK_OPTIONS = ['BDO', 'BPI', 'UnionBank', 'Metrobank', 'Landbank', 'Security Bank', 'Other Bank'];
const EWALLET_OPTIONS = [
  { id: 'gcash', name: 'GCash', tag: '09XX-XXX-XXXX' },
  { id: 'maya', name: 'Maya', tag: '09XX-XXX-XXXX' }
];

export default function ReservationModal({
  location, // { id, type, number, name, area, price, paxDesc, defaultPax }
  existingReservation,
  onClose,
  onSuccess
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const { currentUser } = useAuthStore();
  const { createReservation, updateReservationStatus, cancelReservation } = useReservationStore();
  const { addItem } = useCartStore();

  // Mode: 'view' (if already reserved) or 'create'
  const isExisting = !!existingReservation;

  // Form State
  const [clientName, setClientName] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [pax, setPax] = useState(location?.defaultPax || 6);
  const [timeSlot, setTimeSlot] = useState('Event Night Â· 7:00 PM');
  const [notes, setNotes] = useState('');

  // Payment State
  const [paymentOption, setPaymentOption] = useState('full'); // 'full' | 'deposit' | 'unpaid'
  const [depositAmount, setDepositAmount] = useState(String(Math.round(location?.price ? location.price / 2 : 0)));
  const [paymentCategory, setPaymentCategory] = useState('cash'); // 'cash' | 'bank_transfer' | 'ewallet'
  
  // Cash Tendered
  const [cashTendered, setCashTendered] = useState('');

  // Bank Transfer
  const [selectedBank, setSelectedBank] = useState('BDO');
  const [bankRef, setBankRef] = useState('');

  // E-Wallet
  const [selectedEwallet, setSelectedEwallet] = useState('gcash');
  const [ewalletRef, setEwalletRef] = useState('');

  // Status after creation
  const [createdSlip, setCreatedSlip] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Computed amounts
  const amountToPay = useMemo(() => {
    if (paymentOption === 'unpaid') return 0;
    if (paymentOption === 'deposit') return Math.max(0, parseFloat(depositAmount || 0));
    return location?.price || 0;
  }, [paymentOption, depositAmount, location?.price]);

  const changeDue = useMemo(() => {
    if (paymentCategory !== 'cash') return 0;
    const tendered = parseFloat(cashTendered || 0);
    return Math.max(0, tendered - amountToPay);
  }, [paymentCategory, cashTendered, amountToPay]);

  // Cash quick amounts
  const quickCashOptions = useMemo(() => {
    const amt = amountToPay;
    if (!amt) return [];
    return [
      { label: 'Exact', value: amt },
      { label: '+â‚±500', value: amt + 500 },
      { label: '+â‚±1,000', value: amt + 1000 },
      { label: 'â‚±5,000', value: 5000 },
      { label: 'â‚±10,000', value: 10000 },
    ].filter(o => o.value >= amt);
  }, [amountToPay]);

  // â”€â”€ Existing Reservation Actions â”€â”€
  const handleMarkArrived = async () => {
    await updateReservationStatus(existingReservation.id, 'occupied');
    toast.success(`${existingReservation.locationName} marked as Occupied (Guest Arrived)`);
    onClose();
  };

  const handleCancelReservation = async () => {
    if (!window.confirm(`Are you sure you want to cancel the reservation for ${existingReservation.locationName}? This will release the table.`)) {
      return;
    }
    await cancelReservation(existingReservation.id);
    toast.info(`Reservation for ${existingReservation.locationName} has been cancelled`);
    onClose();
  };

  const handleAddExtraOrdersToCart = () => {
    // Add a table context item into cart
    addItem({
      id: `table-order-${existingReservation.locationId}`,
      name: `${existingReservation.locationName} - Extra Orders (${existingReservation.clientName})`,
      price: 0,
      stock: 100,
      cost: 0,
      description: `Table order for ${existingReservation.clientName}`
    });
    toast.success(`Table order linked to cart for ${existingReservation.clientName}`);
    onClose();
  };

  // â”€â”€ Create New Reservation & Payment â”€â”€
  const handleConfirmReservation = async (e) => {
    e.preventDefault();
    if (!clientName.trim()) {
      toast.warning('Please enter the client / guest name');
      return;
    }

    if (amountToPay > 0 && paymentCategory === 'cash') {
      const tendered = parseFloat(cashTendered || 0);
      if (tendered < amountToPay) {
        toast.warning(`Cash tendered (${formatCurrency(tendered)}) is less than amount due (${formatCurrency(amountToPay)})`);
        return;
      }
    }

    if (amountToPay > 0 && paymentCategory === 'bank_transfer' && !bankRef.trim()) {
      toast.warning('Please enter Bank Transfer Reference Number');
      return;
    }

    if (amountToPay > 0 && paymentCategory === 'ewallet' && !ewalletRef.trim()) {
      toast.warning('Please enter E-Wallet (GCash / Maya) Reference Number');
      return;
    }

    setSubmitting(true);

    try {
      let paymentDetails = {};
      let paymentMethodCode = 'cash';

      if (paymentCategory === 'cash') {
        paymentMethodCode = 'cash';
        paymentDetails = {
          category: 'cash',
          amountReceived: cashTendered ? parseFloat(cashTendered) : amountToPay,
          change: changeDue
        };
      } else if (paymentCategory === 'bank_transfer') {
        paymentMethodCode = 'bank_transfer';
        paymentDetails = {
          category: 'bank_transfer',
          provider: selectedBank,
          reference: bankRef.trim(),
          amountReceived: amountToPay
        };
      } else if (paymentCategory === 'ewallet') {
        paymentMethodCode = selectedEwallet;
        paymentDetails = {
          category: 'ewallet',
          provider: selectedEwallet === 'gcash' ? 'GCash' : 'Maya',
          reference: ewalletRef.trim(),
          amountReceived: amountToPay
        };
      }

      const res = await createReservation({
        locationId: location.id,
        locationType: location.type,
        locationNumber: location.number,
        locationName: location.name,
        clientName,
        clientContact,
        clientEmail: '',
        pax,
        timeSlot,
        notes,
        totalAmount: location.price,
        paidAmount: amountToPay,
        paymentStatus: amountToPay >= location.price ? 'paid' : (amountToPay > 0 ? 'partial' : 'unpaid'),
        paymentMethod: paymentMethodCode,
        paymentCategory,
        paymentDetails,
        cashierId: currentUser?.id,
        cashierName: currentUser?.displayName || currentUser?.name || 'Cashier'
      });

      if (res.success) {
        toast.success(`Reservation confirmed for ${location.name}!`);
        setCreatedSlip(res.reservation);
        if (onSuccess) onSuccess(res.reservation);
      }
    } catch (err) {
      console.error('Reservation error:', err);
      toast.error('Failed to create reservation');
    } finally {
      setSubmitting(false);
    }
  };

  // Add Table to Cart without full instant checkout
  const handleAddToCartAndShop = () => {
    if (!clientName.trim()) {
      toast.warning('Please enter the client name before adding to order');
      return;
    }

    addItem({
      id: location.id,
      name: `${location.name} (${clientName})`,
      price: location.price,
      stock: 1,
      cost: 0,
      description: `${location.area} Â· Consumable for ${pax} pax Â· Client: ${clientName}`
    });

    toast.success(`${location.name} added to Current Order with client: ${clientName}`);
    onClose();
  };

  return (
    <div className="reservation-modal-backdrop" onClick={onClose}>
      <div className="reservation-modal-sheet animate-fade-in" onClick={e => e.stopPropagation()}>
        
        {/* Modal Top Header */}
        <div className="res-modal-header">
          <div className="res-modal-title-area">
            <div className="res-pill-tag">
              <Sparkles size={12} />
              <span>{location?.area || 'Event Venue'}</span>
            </div>
            <h2>{location?.name}</h2>
            <p className="res-subtitle">
              {location?.paxDesc || 'Event Spot'} â€¢ Price: <strong>{formatCurrency(location?.price || 0)}</strong>
            </p>
          </div>
          <button className="res-modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {/* 1. SLIP VIEW (AFTER SUCCESSFUL CREATION)                  */}
        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {createdSlip ? (
          <div className="res-success-pane animate-fade-in">
            <div className="res-ticket-pass">
              {/* Ticket Decorative Cutout Notches */}
              <div className="res-ticket-notch res-ticket-notch--left"></div>
              <div className="res-ticket-notch res-ticket-notch--right"></div>

              {/* 1. Header & Brand Emblem */}
              <div className="res-ticket-header">
                <div className="res-ticket-logo-box">
                  <img src="/LUCID.png" alt="Lucid â€” The youth generation" className="res-ticket-logo" />
                </div>
                <div className="res-ticket-badge">
                  <Sparkles size={11} />
                  <span>OFFICIAL VIP EVENT PASS & RECEIPT</span>
                </div>
                <h3 className="res-ticket-title">{createdSlip.locationName}</h3>
                <div className="res-ticket-ref-bar">
                  <span className="res-ticket-ref">PASS #{createdSlip.reservationNumber}</span>
                  <span className="res-ticket-dot">â€¢</span>
                  <span className="res-ticket-date">
                    {new Date(createdSlip.createdAt || Date.now()).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              </div>

              {/* Perforation Line */}
              <div className="res-ticket-perforation"></div>

              {/* 2. Structured Details Cards Grid */}
              <div className="res-ticket-body">
                <div className="res-ticket-grid">
                  <div className="res-ticket-card">
                    <span className="ticket-card-label"><User size={12} /> GUEST / CLIENT</span>
                    <span className="ticket-card-val ticket-card-val--name">{createdSlip.clientName}</span>
                  </div>
                  <div className="res-ticket-card">
                    <span className="ticket-card-label"><Phone size={12} /> CONTACT</span>
                    <span className="ticket-card-val">{createdSlip.clientContact || 'None provided'}</span>
                  </div>
                  <div className="res-ticket-card">
                    <span className="ticket-card-label"><Users size={12} /> CAPACITY & ADMISSION</span>
                    <span className="ticket-card-val">
                      {createdSlip.pax} Guests <span className="ticket-subbadge">Consumable</span>
                    </span>
                  </div>
                  <div className="res-ticket-card">
                    <span className="ticket-card-label"><Clock size={12} /> SESSION / TIME</span>
                    <span className="ticket-card-val">{createdSlip.timeSlot}</span>
                  </div>
                </div>

                {/* 3. Settlement Highlight Banner */}
                <div className="res-ticket-settlement">
                  <div className="settlement-left">
                    <span className="settlement-label"><ShieldCheck size={14} /> PAYMENT METHOD</span>
                    <span className="settlement-method">{createdSlip.paymentCategory.replace('_', ' ').toUpperCase()}</span>
                    {createdSlip.paymentDetails?.reference && (
                      <span className="settlement-ref">Ref: {createdSlip.paymentDetails.reference}</span>
                    )}
                  </div>
                  <div className="settlement-right">
                    <span className="settlement-amount-label">TOTAL SETTLED</span>
                    <span className="settlement-amount">{formatCurrency(createdSlip.paidAmount)}</span>
                  </div>
                </div>

                <div className="res-ticket-cashier-row">
                  <span>Issued by: <strong>{createdSlip.cashierName}</strong></span>
                  <span className="res-ticket-status-pill">PAID & CONFIRMED</span>
                </div>
              </div>

              {/* Perforation Line */}
              <div className="res-ticket-perforation"></div>

              {/* 4. QR Code Section */}
              <ResTicketQR slip={createdSlip} />

              {/* 5. Security Barcode & Stub Footer */}
              <div className="res-ticket-footer">
                <div className="res-ticket-barcode-wrap">
                  <div className="res-ticket-barcode-lines">
                    <span className="b-bar b-1"></span><span className="b-bar b-3"></span><span className="b-bar b-2"></span>
                    <span className="b-bar b-4"></span><span className="b-bar b-1"></span><span className="b-bar b-3"></span>
                    <span className="b-bar b-2"></span><span className="b-bar b-1"></span><span className="b-bar b-4"></span>
                    <span className="b-bar b-2"></span><span className="b-bar b-3"></span><span className="b-bar b-1"></span>
                    <span className="b-bar b-4"></span><span className="b-bar b-2"></span><span className="b-bar b-1"></span>
                    <span className="b-bar b-3"></span><span className="b-bar b-4"></span><span className="b-bar b-2"></span>
                    <span className="b-bar b-1"></span><span className="b-bar b-3"></span><span className="b-bar b-2"></span>
                    <span className="b-bar b-4"></span><span className="b-bar b-1"></span><span className="b-bar b-2"></span>
                  </div>
                  <span className="res-ticket-barcode-code">#{createdSlip.reservationNumber}</span>
                </div>
                <div className="res-ticket-notice">
                  <Camera size={13} />
                  <span>Guest may take a photo of this pass slip Â· Present upon VIP entrance</span>
                </div>
                <span className="res-ticket-watermark">EXCLUSIVE ACCESS Â· NON-TRANSFERABLE</span>
              </div>
            </div>

            {/* Quick Actions after reservation */}
            <div className="res-success-actions">
              <button
                type="button"
                className="res-btn res-btn--download"
                onClick={() => downloadTicketPassImage(createdSlip)}
              >
                <Download size={18} />
                <span>Download Soft Copy (PNG)</span>
              </button>
              <button
                type="button"
                className="res-btn res-btn--dashboard"
                onClick={() => {
                  onClose();
                  navigate('/dashboard');
                }}
              >
                <LayoutDashboard size={18} />
                <span>Direct to Dashboard (Accounting)</span>
              </button>
              <button
                type="button"
                className="res-btn res-btn--print"
                onClick={() => window.print()}
              >
                <Printer size={18} />
                <span>Print Pass Slip</span>
              </button>
              <button
                type="button"
                className="res-btn res-btn--close"
                onClick={onClose}
              >
                Done (Back to Map)
              </button>
            </div>
          </div>
        ) : isExisting ? (
          /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
          /* 2. EXISTING RESERVATION DETAILS (OCCUPIED / RESERVED)       */
          /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
          <div className="res-existing-pane animate-fade-in">
            <div className="res-status-banner res-status-banner--reserved">
              <div className="status-indicator"></div>
              <div>
                <strong>Currently Reserved & Billed</strong>
                <p>Booked on {new Date(existingReservation.createdAt).toLocaleString('en-PH')}</p>
              </div>
              <span className={`status-badge status-badge--${existingReservation.status}`}>
                {existingReservation.status.toUpperCase()}
              </span>
            </div>

            <div className="res-card">
              <h4>Guest Information</h4>
              <div className="res-info-grid">
                <div className="info-item">
                  <span className="info-label"><User size={14} /> Client Name</span>
                  <span className="info-val">{existingReservation.clientName}</span>
                </div>
                <div className="info-item">
                  <span className="info-label"><Phone size={14} /> Contact</span>
                  <span className="info-val">{existingReservation.clientContact || 'None provided'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label"><Users size={14} /> Capacity</span>
                  <span className="info-val">{existingReservation.pax} Guests</span>
                </div>
                <div className="info-item">
                  <span className="info-label"><Clock size={14} /> Session</span>
                  <span className="info-val">{existingReservation.timeSlot}</span>
                </div>
              </div>
              {existingReservation.notes && (
                <div className="info-notes">
                  <FileText size={14} />
                  <span>{existingReservation.notes}</span>
                </div>
              )}
            </div>

            <div className="res-card">
              <h4>Billing & Settlement</h4>
              <div className="res-info-grid">
                <div className="info-item">
                  <span className="info-label">Total Table Rate</span>
                  <span className="info-val">{formatCurrency(existingReservation.totalAmount)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Paid Amount</span>
                  <span className="info-val text-success">{formatCurrency(existingReservation.paidAmount)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Payment Category</span>
                  <span className="info-val capitalize">{existingReservation.paymentCategory?.replace('_', ' ')}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Reference No.</span>
                  <span className="info-val">{existingReservation.paymentDetails?.reference || existingReservation.transactionRef || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="res-manage-actions">
              {existingReservation.status === 'reserved' && (
                <button
                  type="button"
                  className="res-action-btn res-action-btn--arrived"
                  onClick={handleMarkArrived}
                >
                  <UserCheck size={18} />
                  <span>Mark Guest as Arrived</span>
                </button>
              )}
              <button
                type="button"
                className="res-action-btn res-action-btn--orders"
                onClick={handleAddExtraOrdersToCart}
              >
                <Wine size={18} />
                <span>Add Extra Bar Orders to Table</span>
              </button>
              <button
                type="button"
                className="res-action-btn res-action-btn--cancel"
                onClick={handleCancelReservation}
              >
                <Ban size={18} />
                <span>Cancel Reservation (Release Table)</span>
              </button>
            </div>
          </div>
        ) : (
          /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
          /* 3. NEW RESERVATION & BILLING FORM                         */
          /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
          <form className="res-form animate-fade-in" onSubmit={handleConfirmReservation}>
            
            {/* 1. Client Information */}
            <div className="res-form-section">
              <div className="res-section-title">
                <User size={16} />
                <span>Client & Guest Details</span>
              </div>

              <div className="res-fields-row">
                <div className="res-field res-field--grow">
                  <label>Client / Guest Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maria Santos"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="res-field">
                  <label>Contact Number</label>
                  <input
                    type="tel"
                    placeholder="0917-XXX-XXXX"
                    value={clientContact}
                    onChange={e => setClientContact(e.target.value)}
                  />
                </div>
              </div>

              <div className="res-fields-row">
                <div className="res-field">
                  <label>Number of Guests (Pax)</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={pax}
                    onChange={e => setPax(e.target.value)}
                  />
                </div>
                <div className="res-field res-field--grow">
                  <label>Session / Arrival Time</label>
                  <input
                    type="text"
                    value={timeSlot}
                    onChange={e => setTimeSlot(e.target.value)}
                    placeholder="e.g. Event Night 7:00 PM"
                  />
                </div>
              </div>

              <div className="res-field">
                <label>Special Notes & Requests</label>
                <input
                  type="text"
                  placeholder="e.g. Birthday setup / Grey Goose vodka on standby"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            </div>

            {/* 2. Billing & Payment Option */}
            <div className="res-form-section">
              <div className="res-section-title">
                <Banknote size={16} />
                <span>Bills Payment & Settlement</span>
              </div>

              {/* Payment Type Selection */}
              <div className="res-payment-options">
                <button
                  type="button"
                  className={`res-opt-btn ${paymentOption === 'full' ? 'res-opt-btn--active' : ''}`}
                  onClick={() => setPaymentOption('full')}
                >
                  <span className="res-opt-title">Full Payment</span>
                  <span className="res-opt-amount">{formatCurrency(location.price)}</span>
                </button>

                <button
                  type="button"
                  className={`res-opt-btn ${paymentOption === 'deposit' ? 'res-opt-btn--active' : ''}`}
                  onClick={() => setPaymentOption('deposit')}
                >
                  <span className="res-opt-title">Downpayment</span>
                  <span className="res-opt-amount">50% or Custom</span>
                </button>

                <button
                  type="button"
                  className={`res-opt-btn ${paymentOption === 'unpaid' ? 'res-opt-btn--active' : ''}`}
                  onClick={() => setPaymentOption('unpaid')}
                >
                  <span className="res-opt-title">Reserve Only</span>
                  <span className="res-opt-amount">Pay on Arrival</span>
                </button>
              </div>

              {/* Custom deposit input */}
              {paymentOption === 'deposit' && (
                <div className="res-deposit-input-box animate-fade-in">
                  <label>Deposit Amount (â‚±)</label>
                  <input
                    type="number"
                    min="1"
                    max={location.price}
                    value={depositAmount}
                    onChange={e => setDepositAmount(e.target.value)}
                  />
                </div>
              )}

              {/* 3 Categories of Payment: Cash, Bank Transfer, E-Wallet */}
              {amountToPay > 0 && (
                <div className="res-payment-category-block animate-fade-in">
                  <span className="category-block-label">Select 1 of 3 Payment Methods:</span>
                  
                  <div className="res-categories-tabs">
                    <button
                      type="button"
                      className={`res-tab-btn ${paymentCategory === 'cash' ? 'res-tab-btn--active' : ''}`}
                      onClick={() => setPaymentCategory('cash')}
                    >
                      <Banknote size={16} />
                      <span>Cash</span>
                    </button>

                    <button
                      type="button"
                      className={`res-tab-btn ${paymentCategory === 'bank_transfer' ? 'res-tab-btn--active' : ''}`}
                      onClick={() => setPaymentCategory('bank_transfer')}
                    >
                      <Building2 size={16} />
                      <span>Bank Transfer</span>
                    </button>

                    <button
                      type="button"
                      className={`res-tab-btn ${paymentCategory === 'ewallet' ? 'res-tab-btn--active' : ''}`}
                      onClick={() => setPaymentCategory('ewallet')}
                    >
                      <Smartphone size={16} />
                      <span>E-Wallet</span>
                    </button>
                  </div>

                  {/* Cash Inputs */}
                  {paymentCategory === 'cash' && (
                    <div className="res-payment-details-pane animate-fade-in">
                      <div className="res-field">
                        <label>Cash Tendered (â‚±)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder={String(amountToPay)}
                          value={cashTendered}
                          onChange={e => setCashTendered(e.target.value)}
                        />
                      </div>

                      {/* Quick Chips */}
                      <div className="res-quick-cash-row">
                        {quickCashOptions.map((opt, i) => (
                          <button
                            key={i}
                            type="button"
                            className="res-quick-cash-chip"
                            onClick={() => setCashTendered(String(opt.value))}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {/* Change display */}
                      <div className="res-change-summary">
                        <span>Change Due:</span>
                        <strong className={changeDue > 0 ? 'text-success' : ''}>{formatCurrency(changeDue)}</strong>
                      </div>
                    </div>
                  )}

                  {/* Bank Transfer Inputs */}
                  {paymentCategory === 'bank_transfer' && (
                    <div className="res-payment-details-pane animate-fade-in">
                      <div className="res-field">
                        <label>Select Bank</label>
                        <select value={selectedBank} onChange={e => setSelectedBank(e.target.value)}>
                          {BANK_OPTIONS.map(bank => (
                            <option key={bank} value={bank}>{bank}</option>
                          ))}
                        </select>
                      </div>

                      <div className="res-field">
                        <label>Bank Reference / Confirmation Number *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. BDO-98421849"
                          value={bankRef}
                          onChange={e => setBankRef(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* E-Wallet (GCash / Maya) Inputs */}
                  {paymentCategory === 'ewallet' && (
                    <div className="res-payment-details-pane animate-fade-in">
                      <div className="res-ewallet-selector">
                        {EWALLET_OPTIONS.map(wallet => (
                          <button
                            key={wallet.id}
                            type="button"
                            className={`res-wallet-btn ${selectedEwallet === wallet.id ? 'res-wallet-btn--active' : ''}`}
                            onClick={() => setSelectedEwallet(wallet.id)}
                          >
                            <span>{wallet.name}</span>
                          </button>
                        ))}
                      </div>

                      <div className="res-field">
                        <label>{selectedEwallet === 'gcash' ? 'GCash' : 'Maya'} Reference Number *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 1009 4820 9812"
                          value={ewalletRef}
                          onChange={e => setEwalletRef(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Form Action Buttons */}
            <div className="res-form-actions">
              <button
                type="submit"
                className="res-submit-btn res-submit-btn--pay"
                disabled={submitting}
              >
                <ShieldCheck size={18} />
                <span>
                  {amountToPay > 0
                    ? `Confirm & Settle Payment (${formatCurrency(amountToPay)})`
                    : 'Confirm Reservation (Unpaid)'}
                </span>
              </button>

              <button
                type="button"
                className="res-submit-btn res-submit-btn--cart"
                onClick={handleAddToCartAndShop}
              >
                Add Table to Cart & Ring Up Drinks
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- */
/* QR CODE SECTION (embedded in pass slip)                    */
/* ---------------------------------------------------------- */
function ResTicketQR({ slip }) {
  const [qrDataURL, setQrDataURL] = useState(null);
  const [copied, setCopied] = useState(false);
  const { addToast } = useToast();

  const passUrl = useMemo(() => getPassURL(slip), [slip]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const dataURL = await generateQRDataURL(passUrl, 240, '#000000', '#ffffff');
        if (!cancelled) setQrDataURL(dataURL);
      } catch (err) {
        console.error('QR generation error:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [passUrl]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(passUrl);
    setCopied(true);
    addToast('Digital Pass link copied to clipboard', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="res-ticket-qr-section">
      <div className="res-ticket-validity">
        <Sparkles size={13} />
        <span>
          <strong>OFFICIAL VIP PASS</strong>&nbsp;&nbsp;·&nbsp;&nbsp;Scan to open soft copy on mobile
        </span>
      </div>

      <div className="res-ticket-qr-box">
        {qrDataURL ? (
          <img
            src={qrDataURL}
            alt="Scan for digital pass"
            className="res-ticket-qr-img"
            title="Scan with mobile camera to view guest pass"
          />
        ) : (
          <div className="res-ticket-qr-placeholder">
            <QrCode size={48} color="#475569" />
            <span>Generating QR code…</span>
          </div>
        )}
      </div>

      <div className="res-ticket-qr-instructions">
        <QrCode size={13} />
        <span>Point phone camera at QR to open mobile VIP ticket</span>
      </div>

      <div className="res-ticket-qr-actions">
        <a
          href={passUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="res-ticket-link-btn"
          title="Open pass directly in new tab"
        >
          <ExternalLink size={12} />
          <span>Open Pass Link</span>
        </a>
        <button
          type="button"
          className="res-ticket-link-btn"
          onClick={handleCopyLink}
          title="Copy pass URL to clipboard"
        >
          {copied ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
          <span>{copied ? 'Copied Link!' : 'Copy Link'}</span>
        </button>
      </div>
    </div>
  );

}
