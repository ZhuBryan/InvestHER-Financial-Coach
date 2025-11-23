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

Task:
1. Calculate how many "fancy coffees" (at $6 each) this amount equals. Format: "X fancy coffees with friends".
2. Calculate how many weeks of groceries (at $100/week) this amount equals. Format: "X weeks of groceries".
3. Calculate a specific contribution to their goal ("${goalList}"). Format: "X% of your [Goal Name] goal" or "A significant step toward [Goal Name]".
4. Generate 1 "Pro" of buying this item (be witty/sarcastic but acknowledge it's nice).
5. Generate 1 "Con" of buying this item (financial reality check).
6. Write a short, punchy 1-sentence message (max 20 words) persuading them to save this money instead.

Return ONLY a JSON object with this structure:
{
  "alternatives": ["coffee_calc", "grocery_calc", "goal_calc"],
  "pro": "The pro text",
  "con": "The con text",
  "message": "The persuasive message"
}`;

    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    
    const geminiData = await geminiRes.json();
    let aiResponse = {
        alternatives: ["Invest in your future", "Save for a rainy day", "Treat yourself later"],
        pro: "It looks nice!",
        con: "Do you really need it?",
        message: "Think about your future!"
    };

    if (geminiData.candidates && geminiData.candidates[0].content) {
        const text = geminiData.candidates[0].content.parts[0].text.trim();
        // Clean up markdown code blocks if present
        const jsonText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        try {
            aiResponse = JSON.parse(jsonText);
        } catch (e) {
            console.error("JSON Parse Error:", e);
        }
    }

    // 4. Call ElevenLabs API
    const elevenApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    let audioBase64 = null;

    if (elevenApiKey && aiResponse.message) {
        try {
            const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'xi-api-key': elevenApiKey
                },
                body: JSON.stringify({
                    text: aiResponse.message,
                    model_id: "eleven_monolingual_v1",
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.5
                    }
                })
            });

            if (elevenRes.ok) {
                const audioBuffer = await elevenRes.arrayBuffer();
                // Convert ArrayBuffer to Base64
                const bytes = new Uint8Array(audioBuffer);
                let binary = '';
                for (let i = 0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                audioBase64 = btoa(binary);
            } else {
                console.error("ElevenLabs Error:", await elevenRes.text());
            }
        } catch (e) {
            console.error("ElevenLabs Exception:", e);
        }
    }

    // 5. Return Result
    return new Response(
      JSON.stringify({ ...aiResponse, audio: audioBase64 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("Edge Function Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
