import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Create Supabase client with the Auth context of the logged in user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get user from auth
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // Parse request body
    const { marketId, outcome, amount } = await req.json()

    if (!marketId || !outcome || !amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid input: marketId, outcome, and positive amount required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    if (!['A', 'B'].includes(outcome)) {
      return new Response(
        JSON.stringify({ error: 'Invalid outcome: must be A or B' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Get user profile and check balance
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('sol_balance, total_bets')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    const currentBalance = parseFloat(profile.sol_balance.toString())
    
    if (currentBalance < amount) {
      return new Response(
        JSON.stringify({ error: 'Insufficient balance' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Get market details
    const { data: market, error: marketError } = await supabaseClient
      .from('markets')
      .select('*')
      .eq('id', marketId)
      .single()

    if (marketError || !market) {
      return new Response(JSON.stringify({ error: 'Market not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    if (market.status !== 'Active') {
      return new Response(JSON.stringify({ error: 'Market is not active' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Calculate payout based on current price
    const priceAtBet = outcome === 'A' ? parseFloat(market.price_a.toString()) : parseFloat(market.price_b.toString())
    const potentialPayout = amount * (1 / priceAtBet)

    // Start transaction: Update balance, create bet, update market volume
    const newBalance = currentBalance - amount
    
    const { error: updateBalanceError } = await supabaseClient
      .from('profiles')
      .update({ 
        sol_balance: newBalance,
        total_bets: profile.total_bets + 1
      })
      .eq('id', user.id)

    if (updateBalanceError) {
      console.error('Error updating balance:', updateBalanceError)
      return new Response(JSON.stringify({ error: 'Failed to update balance' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // Create bet record
    const { error: betError } = await supabaseClient
      .from('bets')
      .insert({
        market_id: marketId,
        user_id: user.id,
        outcome,
        amount,
        price_at_bet: priceAtBet,
        potential_payout: potentialPayout,
      })

    if (betError) {
      console.error('Error creating bet:', betError)
      // Rollback balance update
      await supabaseClient
        .from('profiles')
        .update({ 
          sol_balance: currentBalance,
          total_bets: profile.total_bets
        })
        .eq('id', user.id)
        
      return new Response(JSON.stringify({ error: 'Failed to create bet' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // Update market volume and slightly adjust prices based on bet
    const currentVolume = parseFloat(market.volume.toString())
    const newVolume = currentVolume + amount
    
    // Simple price update: outcome being bet on gets slightly more expensive
    let newPriceA = parseFloat(market.price_a.toString())
    let newPriceB = parseFloat(market.price_b.toString())
    
    const priceImpact = Math.min(0.02, amount / 10000) // Max 2% price impact
    
    if (outcome === 'A') {
      newPriceA = Math.min(0.99, newPriceA + priceImpact)
      newPriceB = 1 - newPriceA
    } else {
      newPriceB = Math.min(0.99, newPriceB + priceImpact)
      newPriceA = 1 - newPriceB
    }

    const { error: marketUpdateError } = await supabaseClient
      .from('markets')
      .update({ 
        volume: newVolume,
        price_a: newPriceA,
        price_b: newPriceB,
      })
      .eq('id', marketId)

    if (marketUpdateError) {
      console.error('Error updating market:', marketUpdateError)
      // Market update failing is not critical, continue
    }

    console.log(`Bet placed successfully: ${amount} SOL on outcome ${outcome} for market ${marketId}`)

    return new Response(
      JSON.stringify({
        success: true,
        newBalance,
        potentialPayout,
        message: 'Bet placed successfully!',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Error in place-bet function:', error)
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
