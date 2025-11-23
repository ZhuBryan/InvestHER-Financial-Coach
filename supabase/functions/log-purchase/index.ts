import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id, total_price, products, store, category, store_image, status } = await req.json()

    console.log("Received purchase data:", { user_id, total_price, store, category, status });

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data, error } = await supabaseClient
      .from('purchases')
      .insert([
        {
          user_id,
          total_price,
          products, // JSONB array
          store,
          category,
          store_image,
          status // 'success' (saved) or 'failure' (bought)
        }
      ])
      .select()

    if (error) {
      console.error("Supabase Insert Error:", error);
      throw error
    }

    console.log("Purchase inserted successfully:", data);

    return new Response(
      JSON.stringify({ message: "Purchase logged successfully", data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("Log Purchase Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
