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

    if (!marketId || !outcome || !amount) {
      return new Response(
        JSON.stringify({ error: 'Invalid input: marketId, outcome, and amount required' }),
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

    // Call atomic transaction function to prevent race conditions
    const { data: result, error: rpcError } = await supabaseClient
      .rpc('place_bet_atomic', {
        p_user_id: user.id,
        p_market_id: marketId,
        p_outcome: outcome,
        p_amount: amount
      })

    if (rpcError) {
      console.error('Error calling place_bet_atomic:', rpcError)
      return new Response(
        JSON.stringify({ error: 'Failed to place bet' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    // Check if the function returned an error
    if (result.error) {
      console.log(`Bet rejected: ${result.error}`)
      return new Response(
        JSON.stringify({ error: result.error }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    console.log(`Bet placed successfully: ${amount} SOL on outcome ${outcome} for market ${marketId}`)

    return new Response(
      JSON.stringify({
        success: result.success,
        newBalance: result.newBalance,
        potentialPayout: result.potentialPayout,
        platformFee: result.platformFee,
        grossPayout: result.grossPayout,
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
