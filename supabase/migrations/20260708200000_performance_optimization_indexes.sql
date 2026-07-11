-- ==========================================
-- PERFORMANCE OPTIMIZATION INDEXES MIGRATION
-- ==========================================

-- Indexes for Tenant Isolation (user_id filtering)
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON public.sales (user_id);
CREATE INDEX IF NOT EXISTS idx_staff_user_id ON public.staff (user_id);
CREATE INDEX IF NOT EXISTS idx_cash_cuts_user_id ON public.cash_cuts (user_id);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_user_id ON public.cash_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_user_id ON public.sale_items (user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_user_id ON public.order_items (user_id);

-- Indexes for Cashier Reports (joining/filtering on sessions and terminals)
CREATE INDEX IF NOT EXISTS idx_orders_cash_session_id ON public.orders (cash_session_id);
CREATE INDEX IF NOT EXISTS idx_sales_terminal_id ON public.sales (terminal_id);

-- Indexes for Date Filtering / Sorting (Dashboard and Reports)
CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_created_at_desc ON public.sales (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_cuts_created_at_desc ON public.cash_cuts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_opened_at_desc ON public.cash_sessions (opened_at DESC);
