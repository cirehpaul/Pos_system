-- ==============================================================================
-- LUCID SYSTEM: PRODUCTION POSTGRESQL SCHEMA WITH ROW LEVEL SECURITY (RLS)
-- Target Platform: Supabase PostgreSQL
-- ==============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create custom types
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('owner', 'cashier');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Profiles / Users Table (linked with Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    display_name TEXT,
    username TEXT UNIQUE,
    role user_role NOT NULL DEFAULT 'cashier',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Categories
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT DEFAULT '#3b82f6',
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Products
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
    stock INT NOT NULL DEFAULT 0,
    sku TEXT DEFAULT '',
    min_stock INT DEFAULT 10,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Orders
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL UNIQUE,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
    tax NUMERIC(12, 2) NOT NULL DEFAULT 0,
    discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    payment_category TEXT NOT NULL DEFAULT 'cash',
    payment_provider TEXT DEFAULT '',
    payment_reference TEXT DEFAULT '',
    amount_received NUMERIC(12, 2) NOT NULL DEFAULT 0,
    change NUMERIC(12, 2) NOT NULL DEFAULT 0,
    cashier_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    cashier_name TEXT,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled', 'refunded')),
    is_event_reservation BOOLEAN DEFAULT FALSE,
    reservation_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Clients
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    contact TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Financial Transactions (Cash-in, Cash-out, Bills Payment)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_number TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('cash_in', 'cash_out', 'bills_payment')),
    amount NUMERIC(12, 2) NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    client_name TEXT NOT NULL,
    client_email TEXT,
    client_contact TEXT,
    cashier_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    cashier_name TEXT,
    description TEXT,
    bill_type TEXT,
    account_number TEXT,
    payment_category TEXT DEFAULT 'cash',
    payment_method TEXT DEFAULT 'cash',
    payment_details JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'voided')),
    voided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Reservations (Event floor plan, VIP & table passes)
CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_number TEXT NOT NULL UNIQUE,
    order_number TEXT,
    transaction_ref TEXT,
    location_id TEXT NOT NULL,
    location_type TEXT NOT NULL,
    location_number TEXT,
    location_name TEXT NOT NULL,
    client_name TEXT NOT NULL,
    client_contact TEXT,
    client_email TEXT,
    pax INT DEFAULT 6,
    time_slot TEXT DEFAULT 'Event Night',
    notes TEXT,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'partial', 'unpaid')),
    payment_method TEXT DEFAULT 'cash',
    payment_category TEXT DEFAULT 'cash',
    payment_details JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'occupied', 'cancelled', 'completed')),
    cashier_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    cashier_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Cash Audits (Cash Drawer Variance Verification)
CREATE TABLE IF NOT EXISTS public.cash_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cashier_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    cashier_name TEXT NOT NULL,
    denominations JSONB DEFAULT '{}'::jsonb,
    counted_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    expected_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    variance NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('balanced', 'over', 'short')),
    notes TEXT,
    period TEXT DEFAULT 'all',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Settings
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Login Sessions
CREATE TABLE IF NOT EXISTS public.login_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    role user_role NOT NULL,
    login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    logout_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'logged_out'))
);

-- ==============================================================================
-- SECURITY: ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_sessions ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if current authenticated user is an owner
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'owner'
        )
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'owner'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles: Users can view their own profile; Owner can view and update all profiles
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.is_owner());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.is_owner());
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL USING (public.is_owner());

-- Categories: Anyone authenticated can read; only owner can insert/update/delete
CREATE POLICY "categories_read_auth" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "categories_write_owner" ON public.categories FOR ALL TO authenticated USING (public.is_owner());

-- Products: Anyone authenticated can read; only owner can insert/update/delete
CREATE POLICY "products_read_auth" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_write_owner" ON public.products FOR ALL TO authenticated USING (public.is_owner());

-- Orders: Authenticated staff can insert and read; owner has full control
CREATE POLICY "orders_read_auth" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "orders_insert_auth" ON public.orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "orders_owner_all" ON public.orders FOR ALL TO authenticated USING (public.is_owner());

-- Clients: Authenticated staff can read and write clients
CREATE POLICY "clients_all_auth" ON public.clients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Transactions: Authenticated staff can read and insert; owner can void/update
CREATE POLICY "transactions_read_auth" ON public.transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "transactions_insert_auth" ON public.transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "transactions_owner_all" ON public.transactions FOR ALL TO authenticated USING (public.is_owner());

-- Reservations: Authenticated staff can create/read; guest pass read-only via token/id
CREATE POLICY "reservations_read_auth" ON public.reservations FOR SELECT TO authenticated USING (true);
CREATE POLICY "reservations_anon_guest_pass" ON public.reservations FOR SELECT TO anon USING (true);
CREATE POLICY "reservations_write_auth" ON public.reservations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Cash Audits: Cashiers can insert and see their own audits; owner can view and manage all
CREATE POLICY "cash_audits_select" ON public.cash_audits FOR SELECT TO authenticated USING (auth.uid() = cashier_id OR public.is_owner());
CREATE POLICY "cash_audits_insert" ON public.cash_audits FOR INSERT TO authenticated WITH CHECK (auth.uid() = cashier_id OR public.is_owner());
CREATE POLICY "cash_audits_owner_all" ON public.cash_audits FOR ALL TO authenticated USING (public.is_owner());

-- Settings: Authenticated staff can read; only owner can modify
CREATE POLICY "settings_read_auth" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_write_owner" ON public.settings FOR ALL TO authenticated USING (public.is_owner());

-- Login Sessions: Users can read own sessions; owner can view all
CREATE POLICY "login_sessions_select" ON public.login_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_owner());
CREATE POLICY "login_sessions_insert" ON public.login_sessions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "login_sessions_update" ON public.login_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_owner());

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON public.transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON public.reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_location ON public.reservations(location_id);
