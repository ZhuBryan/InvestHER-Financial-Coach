import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { item_name, price, description, user_id } = await req.json()

    // 1. Initialize Supabase Client
    // The service role key is needed to bypass RLS if necessary, or just use the anon key with RLS policies
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' 
    )

    // 2. Fetch User Context (Goals)
    // We assume a 'goals' table exists: id, user_id, goal
    const { data: goals, error: dbError } = await supabaseClient
      .from('goals')
      .select('goal')
      .eq('user_id', user_id)

    if (dbError) console.error("DB Error:", dbError);

    const goalList = goals?.map(g => g.goal).join(", ") || "Financial Freedom";
    console.log(`Generating coaching for item: ${item_name}, Goals: ${goalList}`);

    // 3. Call Gemini API
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const prompt = `You are 'InvestHer', a financial coach.
The user is about to spend $${price} on '${item_name}'.
Product description: '${description}'.
The user's goals are: ${goalList}.
Write a short, punchy 1-sentence message (max 20 words) persuading them to save this money instead.
Relate it specifically to their goals.
Do NOT mention the name of the item they are buying.`;

    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    
    const geminiData = await geminiRes.json();
    let aiMessage = "Think about your financial freedom!";
    if (geminiData.candidates && geminiData.candidates[0].content) {
        aiMessage = geminiData.candidates[0].content.parts[0].text.trim();
    }

    // 4. Call ElevenLabs API
    const elevenApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM`, {
        method: 'POST',
        headers: {
            'xi-api-key': elevenApiKey ?? '',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            text: aiMessage,
            model_id: "eleven_monolingual_v1",
            voice_settings: { stability: 0.5, similarity_boost: 0.5 }
        })
    });

    if (!elevenRes.ok) {
        console.error("ElevenLabs Error:", await elevenRes.text());
        // Return just text if audio fails
        return new Response(
            JSON.stringify({ message: aiMessage, audio: null }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    const audioBlob = await elevenRes.blob();
    const audioArrayBuffer = await audioBlob.arrayBuffer();
    const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioArrayBuffer)));

    // 5. Return Result
    return new Response(
      JSON.stringify({ message: aiMessage, audio: audioBase64 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("Edge Function Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
