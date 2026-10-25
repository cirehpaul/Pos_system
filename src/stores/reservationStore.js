import { create } from 'zustand';
import db, { generateReferenceNumber, generateOrderNumber } from '../db/database';

const getReservationTable = () => {
  return db.reservations || db.table('reservations');
};

const useReservationStore = create((set, get) => ({
  reservations: [],
  isLoading: false,

  loadReservations: async () => {
    set({ isLoading: true });
    try {
      const table = getReservationTable();
      const all = await table.toArray();
      // Sort newest first
      all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      set({ reservations: all, isLoading: false });
      return all;
    } catch (err) {
      console.error('Failed to load reservations:', err);
      set({ isLoading: false });
      return [];
    }
  },

  getReservationForLocation: (locationId) => {
    return get().reservations.find(
      r => r.locationId === locationId && (r.status === 'reserved' || r.status === 'occupied')
    );
  },

  createReservation: async (data) => {
    const id = crypto.randomUUID();
    const reservationNumber = `RES-${Date.now().toString(36).toUpperCase()}`;
    const orderNumber = generateOrderNumber();
    const txnRef = generateReferenceNumber();

    const reservation = {
      id,
      reservationNumber,
      orderNumber,
      transactionRef: txnRef,
      locationId: data.locationId,
      locationType: data.locationType, // 'vip_table' | 'round_table' | 'booth'
      locationNumber: data.locationNumber,
      locationName: data.locationName,
      clientName: data.clientName.trim(),
      clientContact: data.clientContact ? data.clientContact.trim() : '',
      clientEmail: data.clientEmail ? data.clientEmail.trim() : '',
      pax: parseInt(data.pax, 10) || 6,
      timeSlot: data.timeSlot || 'Event Night',
      notes: data.notes ? data.notes.trim() : '',
      totalAmount: parseFloat(data.totalAmount) || 0,
      paidAmount: parseFloat(data.paidAmount) || 0,
      paymentStatus: data.paymentStatus || 'paid', // 'paid' | 'partial' | 'unpaid'
      paymentMethod: data.paymentMethod || 'cash',
      paymentCategory: data.paymentCategory || 'cash', // 'cash' | 'bank_transfer' | 'ewallet'
      paymentDetails: data.paymentDetails || {},
      status: 'reserved', // 'reserved' | 'occupied' | 'cancelled' | 'completed'
      cashierId: data.cashierId || null,
      cashierName: data.cashierName || 'Cashier',
      createdAt: new Date().toISOString()
    };

    // 1. Save reservation
    await getReservationTable().add(reservation);

    // 2. If payment was made (full or partial deposit), create Order and Money Transaction
    if (reservation.paidAmount > 0) {
      // Create POS Order record
      const order = {
        id: crypto.randomUUID(),
        orderNumber,
        items: [
          {
            productId: `res-${reservation.locationId}`,
            name: `${reservation.locationName} - Reservation (${reservation.clientName})`,
            price: reservation.paidAmount,
            cost: 0,
            quantity: 1,
            subtotal: reservation.paidAmount
          }
        ],
        subtotal: reservation.paidAmount,
        tax: 0,
        discount: 0,
        total: reservation.paidAmount,
        paymentMethod: reservation.paymentMethod,
        paymentCategory: reservation.paymentCategory,
        paymentProvider: reservation.paymentDetails.provider || '',
        paymentReference: reservation.paymentDetails.reference || txnRef,
        amountReceived: reservation.paymentCategory === 'cash' 
          ? (parseFloat(data.paymentDetails.amountReceived) || reservation.paidAmount) 
          : reservation.paidAmount,
        change: reservation.paymentCategory === 'cash' 
          ? Math.max(0, (parseFloat(data.paymentDetails.amountReceived) || reservation.paidAmount) - reservation.paidAmount)
          : 0,
        cashierId: reservation.cashierId,
        cashierName: reservation.cashierName,
        status: 'completed',
        isEventReservation: true,
        reservationId: id,
        createdAt: new Date().toISOString()
      };
      await db.orders.add(order);

      // Create Money Transaction record
      const transaction = {
        id: crypto.randomUUID(),
        referenceNumber: txnRef,
        type: 'bills_payment',
        amount: reservation.paidAmount,
        paymentCategory: reservation.paymentCategory,
        paymentProvider: reservation.paymentDetails.provider || '',
        clientName: reservation.clientName,
        clientContact: reservation.clientContact,
        clientEmail: reservation.clientEmail,
        cashierId: reservation.cashierId,
        cashierName: reservation.cashierName,
        description: `Floor Plan Table Reservation: ${reservation.locationName} for ${reservation.clientName}`,
        billType: 'Table Reservation Billing',
        accountNumber: reservation.locationName,
        status: 'completed',
        emailSent: false,
        createdAt: new Date().toISOString()
      };
      await db.transactions.add(transaction);
    }

    await get().loadReservations();
    return { success: true, reservation };
  },

  updateReservationStatus: async (id, status) => {
    await getReservationTable().update(id, {
      status,
      updatedAt: new Date().toISOString()
    });
    await get().loadReservations();
    return { success: true };
  },

  cancelReservation: async (id) => {
    await getReservationTable().update(id, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString()
    });
    await get().loadReservations();
    return { success: true };
  }
}));

export default useReservationStore;
