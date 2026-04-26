-- Migration to add ticket_preview column to business_settings
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS ticket_preview BOOLEAN DEFAULT true;
