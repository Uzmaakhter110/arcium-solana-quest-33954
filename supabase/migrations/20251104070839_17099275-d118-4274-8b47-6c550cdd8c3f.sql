-- Add platform fee tracking to bets table
ALTER TABLE bets ADD COLUMN platform_fee numeric DEFAULT 0;

-- Add platform revenue tracking table
CREATE TABLE platform_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id uuid REFERENCES markets(id) ON DELETE CASCADE,
  bet_id uuid REFERENCES bets(id) ON DELETE CASCADE,
  fee_amount numeric NOT NULL,
  collected_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on platform_revenue
ALTER TABLE platform_revenue ENABLE ROW LEVEL SECURITY;

-- Admin-only access to revenue data
CREATE POLICY "Only admins can view platform revenue"
ON platform_revenue FOR SELECT
USING (false); -- Change to admin check when you add admin roles

-- Add platform fee rate to markets for flexible pricing
ALTER TABLE markets ADD COLUMN platform_fee_rate numeric DEFAULT 0.05;

-- Add index for revenue queries
CREATE INDEX idx_platform_revenue_market ON platform_revenue(market_id);
CREATE INDEX idx_platform_revenue_collected ON platform_revenue(collected_at);