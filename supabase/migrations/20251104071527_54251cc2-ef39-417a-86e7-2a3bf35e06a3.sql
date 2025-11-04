-- Fix 1: Restrict profile viewing to own data only
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;

CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- Fix 2: Create atomic bet placement function to prevent race conditions
CREATE OR REPLACE FUNCTION place_bet_atomic(
  p_user_id uuid,
  p_market_id uuid,
  p_outcome text,
  p_amount numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
  v_total_bets integer;
  v_market record;
  v_price_at_bet numeric;
  v_platform_fee_rate numeric;
  v_gross_payout numeric;
  v_platform_fee numeric;
  v_potential_payout numeric;
  v_new_balance numeric;
  v_new_price_a numeric;
  v_new_price_b numeric;
  v_new_volume numeric;
  v_price_impact numeric;
  v_bet_id uuid;
BEGIN
  -- Lock the profile row to prevent concurrent modifications
  SELECT sol_balance, total_bets INTO v_balance, v_total_bets
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  -- Validate balance
  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('error', 'Profile not found');
  END IF;
  
  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('error', 'Insufficient balance');
  END IF;
  
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('error', 'Amount must be positive');
  END IF;
  
  IF p_amount > 10000 THEN
    RETURN jsonb_build_object('error', 'Maximum bet is 10000 SOL');
  END IF;
  
  -- Lock and get market
  SELECT * INTO v_market
  FROM markets
  WHERE id = p_market_id
  FOR UPDATE;
  
  IF v_market IS NULL THEN
    RETURN jsonb_build_object('error', 'Market not found');
  END IF;
  
  IF v_market.status != 'Active' THEN
    RETURN jsonb_build_object('error', 'Market is not active');
  END IF;
  
  -- Calculate payouts
  v_price_at_bet := CASE WHEN p_outcome = 'A' THEN v_market.price_a ELSE v_market.price_b END;
  v_platform_fee_rate := COALESCE(v_market.platform_fee_rate, 0.05);
  v_gross_payout := p_amount * (1.0 / v_price_at_bet);
  v_platform_fee := (v_gross_payout - p_amount) * v_platform_fee_rate;
  v_potential_payout := v_gross_payout - v_platform_fee;
  
  -- Update balance
  v_new_balance := v_balance - p_amount;
  UPDATE profiles
  SET sol_balance = v_new_balance,
      total_bets = v_total_bets + 1
  WHERE id = p_user_id;
  
  -- Insert bet and get ID
  INSERT INTO bets (market_id, user_id, outcome, amount, price_at_bet, potential_payout, platform_fee)
  VALUES (p_market_id, p_user_id, p_outcome, p_amount, v_price_at_bet, v_potential_payout, v_platform_fee)
  RETURNING id INTO v_bet_id;
  
  -- Update market volume and prices
  v_new_volume := v_market.volume + p_amount;
  v_price_impact := LEAST(0.02, p_amount / 10000.0);
  
  IF p_outcome = 'A' THEN
    v_new_price_a := LEAST(0.99, v_market.price_a + v_price_impact);
    v_new_price_b := 1.0 - v_new_price_a;
  ELSE
    v_new_price_b := LEAST(0.99, v_market.price_b + v_price_impact);
    v_new_price_a := 1.0 - v_new_price_b;
  END IF;
  
  UPDATE markets
  SET volume = v_new_volume,
      price_a = v_new_price_a,
      price_b = v_new_price_b
  WHERE id = p_market_id;
  
  -- Track platform revenue
  IF v_platform_fee > 0 THEN
    INSERT INTO platform_revenue (market_id, bet_id, fee_amount)
    VALUES (p_market_id, v_bet_id, v_platform_fee);
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'newBalance', v_new_balance,
    'potentialPayout', v_potential_payout,
    'platformFee', v_platform_fee,
    'grossPayout', v_gross_payout
  );
END;
$$;