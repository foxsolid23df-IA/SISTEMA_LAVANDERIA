-- Add pickup_zones table
CREATE TABLE IF NOT EXISTS pickup_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  zone_name VARCHAR(100) NOT NULL,         -- "Colonia Centro"
  keywords TEXT[] NOT NULL DEFAULT '{}',   -- ["centro","col centro","colonia centro"]
  pickup_days INT[] NOT NULL DEFAULT '{}', -- [1,3,5] (1=Lun, 2=Mar... 7=Dom)
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,        -- Use when no zone matches
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE pickup_zones ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can manage their own pickup zones" ON pickup_zones
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add columns to delivery_orders table
ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS preferred_pickup_day VARCHAR(20);
ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS detected_zone VARCHAR(100);
