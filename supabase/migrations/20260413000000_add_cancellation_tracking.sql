-- Migration: Add cancellation tracking to cash_cuts table
-- Date: 2026-04-13
-- Description: Adds columns to track cancelled orders in cash register cuts

ALTER TABLE cash_cuts
ADD COLUMN IF NOT EXISTS cancelled_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cancelled_total DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cancelled_cash DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cancelled_card DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cancelled_transfer DECIMAL(10,2) DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN cash_cuts.cancelled_count IS 'Number of cancelled orders in this cut';
COMMENT ON COLUMN cash_cuts.cancelled_total IS 'Total amount of cancelled orders';
COMMENT ON COLUMN cash_cuts.cancelled_cash IS 'Total cancelled amount paid with cash';
COMMENT ON COLUMN cash_cuts.cancelled_card IS 'Total cancelled amount paid with card';
COMMENT ON COLUMN cash_cuts.cancelled_transfer IS 'Total cancelled amount paid with transfer';
