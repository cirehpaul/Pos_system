import { useState, useEffect, useMemo } from 'react';
import {
  Ticket, Users, Check, Plus, Sparkles, MapPin,
  Flame, Wine, ShieldAlert, HeartPulse, Camera, Music, DoorOpen,
  CalendarCheck, User, Clock, RotateCcw
} from 'lucide-react';
import useCartStore from '../../stores/cartStore';
import useReservationStore from '../../stores/reservationStore';
import useAuthStore from '../../stores/authStore';
import { useToast } from '../../components/Toast/Toast';
import { formatCurrency, resetAllFinancialData } from '../../db/database';
import ReservationModal from './ReservationModal';
import './EventFloorPlan.css';

// ── Tables & Ticket Definitions from Venue Floor Plan ──

const VIP_TABLES = [
  { id: 'vip-7', number: 7, col: 1, row: 1 },
  { id: 'vip-8', number: 8, col: 2, row: 1 },
  { id: 'vip-6', number: 6, col: 1, row: 2 },
  { id: 'vip-9', number: 9, col: 2, row: 2 },
  { id: 'vip-5', number: 5, col: 1, row: 3 },
  { id: 'vip-10', number: 10, col: 2, row: 3 },
  { id: 'vip-4', number: 4, col: 1, row: 4 },
  { id: 'vip-3', number: 3, col: 2, row: 4 },
  { id: 'vip-2', number: 2, col: 1, row: 5 },
  { id: 'vip-1', number: 1, col: 2, row: 5 },
];

const BOOTHS = [
  // Left side of concessionaire section
  { id: 'booth-N', letter: 'N', group: 'left-top' },
  { id: 'booth-M', letter: 'M', group: 'left-top' },
  { id: 'booth-L', letter: 'L', group: 'left-top' },
  { id: 'booth-O', letter: 'O', group: 'left-mid' },
  { id: 'booth-P', letter: 'P', group: 'left-mid' },
  { id: 'booth-T', letter: 'T', group: 'left-mid' },
  { id: 'booth-Q', letter: 'Q', group: 'left-low' },
  { id: 'booth-R', letter: 'R', group: 'left-low' },
  { id: 'booth-S', letter: 'S', group: 'left-low' },
  { id: 'booth-K', letter: 'K', group: 'mid' },
  { id: 'booth-J', letter: 'J', group: 'mid' },
  // Right side of concessionaire section
  { id: 'booth-F', letter: 'F', group: 'right-top' },
  { id: 'booth-G', letter: 'G', group: 'right-top' },
  { id: 'booth-H', letter: 'H', group: 'right-top' },
  { id: 'booth-I', letter: 'I', group: 'right-top' },
  { id: 'booth-E', letter: 'E', group: 'right-mid' },
  { id: 'booth-D', letter: 'D', group: 'right-low' },
  { id: 'booth-C', letter: 'C', group: 'right-low' },
  { id: 'booth-B', letter: 'B', group: 'right-low' },
  { id: 'booth-A', letter: 'A', group: 'right-low' },
];

// Round tables (1 to 34)
const ROUND_TABLES_LEFT = [
  [11, 12, 13, 14, 15],
  [6, 7, 8, 9, 10],
  [1, 2, 3, 4, 5],
];

const ROUND_TABLES_CENTER = [
  [16, 17, 18, 19],
  [20, 21, 22, 23],
  [24, 25, 26, 27],
];

const ROUND_TABLES_RIGHT = [
  [28],
  [29, 30],
  [31, 32],
  [33, 34],
];

export default function EventFloorPlan() {
  const toast = useToast();
  const { currentUser } = useAuthStore();
  const { items, addItem } = useCartStore();
  const { reservations, loadReservations } = useReservationStore();

  const isSuperAdmin = currentUser?.role === 'owner' || currentUser?.role === 'admin' || currentUser?.username === 'admin';

  // Active modal location state
  const [selectedLocation, setSelectedLocation] = useState(null);

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  // Map of active reservations by locationId (only 'reserved' or 'occupied')
  const reservationMap = useMemo(() => {
    const map = {};
    reservations.forEach(r => {
      if (r.status === 'reserved' || r.status === 'occupied') {
        map[r.locationId] = r;
      }
    });
    return map;
  }, [reservations]);

  // Map of items in cart
  const inCartMap = useMemo(() => {
    const map = {};
    items.forEach(item => {
      map[item.productId] = item.quantity;
      map[item.name] = item.quantity;
    });
    return map;
  }, [items]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalLocations = VIP_TABLES.length + BOOTHS.length + 34; // 10 + 20 + 34 = 64
    let reserved = 0;
    let occupied = 0;

    Object.values(reservationMap).forEach(r => {
      if (r.status === 'reserved') reserved++;
      if (r.status === 'occupied') occupied++;
    });

    const available = totalLocations - reserved - occupied;
    return { total: totalLocations, available, reserved, occupied };
  }, [reservationMap]);

  // ── Open Location Click ──
  const handleOpenVIPTable = (tableNumber) => {
    const locId = `vip-table-${tableNumber}`;
    setSelectedLocation({
      id: locId,
      type: 'vip_table',
      number: tableNumber,
      name: `VIP Table #${tableNumber}`,
      area: 'VIP House',
      price: 7500,
      paxDesc: 'Consumable for 5-6 pax',
      defaultPax: 6
    });
  };

  const handleOpenRoundTable = (tableNumber) => {
    const locId = `round-table-${tableNumber}`;
    setSelectedLocation({
      id: locId,
      type: 'round_table',
      number: tableNumber,
      name: `Round Table #${tableNumber}`,
      area: 'Main Hall Poolside',
      price: 2800,
      paxDesc: 'Consumable for 5-6 pax',
      defaultPax: 6
    });
  };

  const handleOpenBooth = (letter) => {
    const locId = `booth-${letter}`;
    setSelectedLocation({
      id: locId,
      type: 'booth',
      number: letter,
      name: `Concessionaire Booth ${letter}`,
      area: 'Vendor Booths Area',
      price: 3500,
      paxDesc: 'Vendor space reservation',
      defaultPax: 4
    });
  };

  // Quick ticket admission (Single unified ticket)
  const handleAddAdmission = (qty = 1) => {
    const name = 'Admission Ticket';
    const price = 550;
    const id = 'tkt-admission';

    for (let i = 0; i < qty; i++) {
      addItem({
        id,
        name,
        price,
        stock: 500,
        cost: 0,
        description: `${name} event pass.`
      });
    }
    toast.success(`Added ${qty}x ${name} (${formatCurrency(price * qty)})`);
  };

  const handleResetAll = async () => {
    if (!isSuperAdmin) {
      toast.error('Permission denied: Only Super Admin can reset system data');
      return;
    }
    const confirmed = window.confirm(
      '⚠️ SUPER ADMIN RESET ACTION:\n\nAre you sure you want to RESET ALL TRANSACTIONS, MONEY, AND RESERVATIONS?\n\nThis will permanently delete all transaction records, cash audits, orders, and table bookings back to zero.\n\nClick OK to proceed.'
    );
    if (!confirmed) return;

    try {
      await resetAllFinancialData();
      await loadReservations();
      toast.success('All transactions, cash records, and reservations have been completely erased');
    } catch (err) {
      console.error(err);
      toast.error('Failed to reset system data');
    }
  };

  return (
    <div className="event-floorplan-container animate-fade-in">
      
      {/* ── Floor Plan Header Banner ── */}
      <div className="floorplan-header">
        <div className="floorplan-title-block">
          <div className="floorplan-badge">
            <Sparkles size={14} />
            <span>Interactive Venue Reservations & Bar Billing</span>
          </div>
          <h2>Venue Floor Plan & Table Booking</h2>
          <p>Click any location on the map to set a client reservation and settle bills payment (Cash / Bank / E-Wallet)</p>
          
          {/* Real-time Counts */}
          <div className="floorplan-stats-pills">
            <span className="stat-pill stat-pill--avail">
              <strong>{stats.available}</strong> Available
            </span>
            <span className="stat-pill stat-pill--res">
              <strong>{stats.reserved}</strong> Reserved
            </span>
            <span className="stat-pill stat-pill--occ">
              <strong>{stats.occupied}</strong> Occupied
            </span>
          </div>
        </div>

        {/* Quick Ticket Admission Adder (Single Unified Ticket) */}
        <div className="quick-tickets-bar">
          <div className="quick-ticket-card quick-ticket-card--walkin">
            <div className="quick-ticket-card__header">
              <span className="quick-ticket-name">Admission Ticket</span>
              <span className="quick-ticket-price">₱550</span>
            </div>
            <div className="quick-ticket-btns">
              <button type="button" onClick={() => handleAddAdmission(1)}>+1</button>
              <button type="button" onClick={() => handleAddAdmission(2)}>+2</button>
              <button type="button" onClick={() => handleAddAdmission(5)}>+5</button>
              <button type="button" onClick={() => handleAddAdmission(10)}>+10</button>
            </div>
          </div>

          {isSuperAdmin && (
            <button
              type="button"
              className="floorplan-reset-btn"
              onClick={handleResetAll}
              title="Super Admin Only: Reset All Transactions & Reservations"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.16)',
                border: '1.5px solid rgba(239, 68, 68, 0.5)',
                color: '#f87171',
                fontWeight: 800,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                height: 'fit-content',
                alignSelf: 'center'
              }}
            >
              <RotateCcw size={15} />
              <span>Reset All Transactions</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Interactive Venue Blueprint Map ── */}
      <div className="venue-map">

        {/* TOP ROW: VIP House & Concessionaire Booths */}
        <div className="venue-top-row">

          {/* 1. VIP House */}
          <div className="venue-section section-vip-house">
            <div className="section-label">
              <Flame size={14} />
              <span>VIP House (₱7,500 Consumable 5-6 pax)</span>
            </div>

            {/* Landmarks */}
            <div className="landmark landmark--foodbar">Food Bar</div>
            <div className="landmark landmark--fire-exit">Fire Exit</div>
            <div className="landmark landmark--cr landmark--cr-left">CR</div>
            <div className="landmark landmark--dj">DJ's Balcony</div>

            {/* VIP Tables Grid */}
            <div className="vip-tables-grid">
              {VIP_TABLES.map(t => {
                const locId = `vip-table-${t.number}`;
                const res = reservationMap[locId];
                const inCart = !!inCartMap[locId];

                let stateClass = '';
                if (res?.status === 'reserved') stateClass = 'table--reserved';
                else if (res?.status === 'occupied') stateClass = 'table--occupied';
                else if (inCart) stateClass = 'table--in-cart';

                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`vip-table-box ${stateClass}`}
                    onClick={() => handleOpenVIPTable(t.number)}
                    title={res ? `VIP Table #${t.number}: ${res.status.toUpperCase()} (${res.clientName})` : `Click to reserve VIP Table #${t.number} — ₱7,500`}
                  >
                    <span className="table-num">{t.number}</span>
                    {res ? (
                      <span className="table-res-tag">
                        {res.status === 'occupied' ? 'OCC' : 'RES'}
                        <span className="table-client-snippet">{res.clientName.split(' ')[0]}</span>
                      </span>
                    ) : inCart ? (
                      <span className="table-check"><Check size={12} /></span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Concessionaire Booths */}
          <div className="venue-section section-concessionaire">
            <div className="section-label">
              <Wine size={14} />
              <span>Concessionaire Booths (₱3,500 Space)</span>
            </div>

            {/* Landmarks */}
            <div className="landmark landmark--cr landmark--cr-right">CR</div>
            <div className="landmark landmark--photobooth"><Camera size={12} /> Photobooth</div>
            <div className="landmark landmark--medic"><HeartPulse size={12} /> Medic</div>
            <div className="landmark landmark--bar-top">Bar Area</div>

            {/* Booths Layout */}
            <div className="booths-cluster">
              {BOOTHS.map(b => {
                const locId = `booth-${b.letter}`;
                const res = reservationMap[locId];
                const inCart = !!inCartMap[locId];

                let stateClass = '';
                if (res?.status === 'reserved') stateClass = 'booth--reserved';
                else if (res?.status === 'occupied') stateClass = 'booth--occupied';
                else if (inCart) stateClass = 'booth--in-cart';

                return (
                  <button
                    key={b.id}
                    type="button"
                    className={`booth-box booth-box--${b.group} ${stateClass}`}
                    onClick={() => handleOpenBooth(b.letter)}
                    title={res ? `Booth ${b.letter}: ${res.status.toUpperCase()} (${res.clientName})` : `Click to reserve Booth ${b.letter} — ₱3,500`}
                  >
                    <span>{b.letter}</span>
                    {res ? (
                      <span className="booth-res-tag">{res.status === 'occupied' ? 'OCC' : 'RES'}</span>
                    ) : inCart ? (
                      <span className="booth-check"><Check size={10} /></span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* MIDDLE ROW: Pool & Central Bar Area */}
        <div className="venue-mid-row">
          <div className="pool-area">
            <div className="pool-water">
              <span>POOL</span>
              <div className="pool-waves"></div>
            </div>
          </div>
          <div className="central-bar">
            <span>Bar Area</span>
          </div>
        </div>

        {/* BOTTOM ROW: Round Tables (1 to 34) */}
        <div className="venue-bottom-row">

          {/* Left Bay (Tables 1 - 15) */}
          <div className="round-tables-bay bay--left">
            <div className="bay-landmark bay-landmark--entrance">
              <DoorOpen size={14} />
              <span>Main Entrance</span>
            </div>
            <div className="bay-landmark bay-landmark--vip-door">VIP</div>

            <div className="round-grid">
              {ROUND_TABLES_LEFT.map((row, rIdx) => (
                <div key={rIdx} className="round-row">
                  {row.map(num => {
                    const locId = `round-table-${num}`;
                    const res = reservationMap[locId];
                    const inCart = !!inCartMap[locId];

                    let stateClass = '';
                    if (res?.status === 'reserved') stateClass = 'round--reserved';
                    else if (res?.status === 'occupied') stateClass = 'round--occupied';
                    else if (inCart) stateClass = 'round--in-cart';

                    return (
                      <button
                        key={num}
                        type="button"
                        className={`round-table-circle ${stateClass}`}
                        onClick={() => handleOpenRoundTable(num)}
                        title={res ? `Round Table #${num}: ${res.status.toUpperCase()} (${res.clientName})` : `Click to reserve Round Table #${num} — ₱2,800`}
                      >
                        <span>{num}</span>
                        {res ? (
                          <span className="round-res-dot" title={`${res.status}: ${res.clientName}`}></span>
                        ) : inCart ? (
                          <span className="round-check"><Check size={10} /></span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Center-Right Bay (Tables 16 - 27) */}
          <div className="round-tables-bay bay--center">
            <div className="bay-landmark bay-landmark--exit">
              <DoorOpen size={14} />
              <span>Main Exit</span>
            </div>

            <div className="round-grid">
              {ROUND_TABLES_CENTER.map((row, rIdx) => (
                <div key={rIdx} className="round-row">
                  {row.map(num => {
                    const locId = `round-table-${num}`;
                    const res = reservationMap[locId];
                    const inCart = !!inCartMap[locId];

                    let stateClass = '';
                    if (res?.status === 'reserved') stateClass = 'round--reserved';
                    else if (res?.status === 'occupied') stateClass = 'round--occupied';
                    else if (inCart) stateClass = 'round--in-cart';

                    return (
                      <button
                        key={num}
                        type="button"
                        className={`round-table-circle ${stateClass}`}
                        onClick={() => handleOpenRoundTable(num)}
                        title={res ? `Round Table #${num}: ${res.status.toUpperCase()} (${res.clientName})` : `Click to reserve Round Table #${num} — ₱2,800`}
                      >
                        <span>{num}</span>
                        {res ? (
                          <span className="round-res-dot" title={`${res.status}: ${res.clientName}`}></span>
                        ) : inCart ? (
                          <span className="round-check"><Check size={10} /></span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Far Right Bay (Tables 28 - 34) */}
          <div className="round-tables-bay bay--right">
            <div className="round-grid">
              {ROUND_TABLES_RIGHT.map((row, rIdx) => (
                <div key={rIdx} className="round-row">
                  {row.map(num => {
                    const locId = `round-table-${num}`;
                    const res = reservationMap[locId];
                    const inCart = !!inCartMap[locId];

                    let stateClass = '';
                    if (res?.status === 'reserved') stateClass = 'round--reserved';
                    else if (res?.status === 'occupied') stateClass = 'round--occupied';
                    else if (inCart) stateClass = 'round--in-cart';

                    return (
                      <button
                        key={num}
                        type="button"
                        className={`round-table-circle ${stateClass}`}
                        onClick={() => handleOpenRoundTable(num)}
                        title={res ? `Round Table #${num}: ${res.status.toUpperCase()} (${res.clientName})` : `Click to reserve Round Table #${num} — ₱2,800`}
                      >
                        <span>{num}</span>
                        {res ? (
                          <span className="round-res-dot" title={`${res.status}: ${res.clientName}`}></span>
                        ) : inCart ? (
                          <span className="round-check"><Check size={10} /></span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Floor Plan Legend Bar ── */}
        <div className="floorplan-legend-bar">
          <span className="legend-heading">STATUS & TIERS:</span>
          
          <div className="legend-entry">
            <span className="status-dot dot--avail"></span>
            <span>Available</span>
          </div>

          <div className="legend-entry">
            <span className="status-dot dot--res"></span>
            <span>Reserved</span>
          </div>

          <div className="legend-entry">
            <span className="status-dot dot--occ"></span>
            <span>Occupied</span>
          </div>

          <div className="legend-divider"></div>

          <div className="legend-entry">
            <div className="legend-symbol symbol--vip"></div>
            <div>
              <strong>₱7,500</strong> VIP Table <span className="text-muted">(1-10)</span>
            </div>
          </div>

          <div className="legend-entry">
            <div className="legend-symbol symbol--round"></div>
            <div>
              <strong>₱2,800</strong> Round Table <span className="text-muted">(1-34)</span>
            </div>
          </div>

          <div className="legend-entry">
            <div className="legend-symbol symbol--booth"></div>
            <div>
              <strong>₱3,500</strong> Booths <span className="text-muted">(A-T)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Reservation & Payment Modal ── */}
      {selectedLocation && (
        <ReservationModal
          location={selectedLocation}
          existingReservation={reservationMap[selectedLocation.id]}
          onClose={() => setSelectedLocation(null)}
          onSuccess={() => {
            loadReservations();
          }}
        />
      )}
    </div>
  );
}
