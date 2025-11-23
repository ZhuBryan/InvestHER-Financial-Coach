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

    // 2. Fetch User Context (Goals & Profile)
    // Fetch Goals
    const { data: goals, error: goalsError } = await supabaseClient
      .from('goals')
      .select('goal')
      .eq('user_id', user_id)

    if (goalsError) console.error("Goals DB Error:", goalsError);
    const goalList = goals?.map(g => g.goal).join(", ") || "Financial Freedom";

    // Fetch User Profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('tone, struggles, motivations')
      .eq('user_id', user_id)
      .single();
    
    if (profileError) console.error("Profile DB Error:", profileError);

    const userTone = profile?.tone || "witty";
    const userStruggles = profile?.struggles ? profile.struggles.join(", ") : "";
    const userMotivations = profile?.motivations ? profile.motivations.join(", ") : "";

    console.log(`Generating coaching for item: ${item_name}, Goals: ${goalList}, Tone: ${userTone}`);

    // 3. Call Gemini API
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
        console.error("GEMINI_API_KEY is not set");
        // Fallback if API key is missing
        return new Response(
            JSON.stringify({
                alternatives: ["Check your settings", "API Key Missing", "Contact Support"],
                pro: "Configuration needed",
                con: "Cannot generate advice without API key",
                message: "Please configure your Gemini API Key in Supabase."
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const prompt = `You are 'InvestHer', a financial coach.
The user is about to spend $${price} on '${item_name}'.
Product description: '${description}'.

User Context:
- Goals: ${goalList}
- Motivations: ${userMotivations}
- Struggles: ${userStruggles}
- Preferred Tone: ${userTone}

Task:
1. Calculate a specific contribution to their goal ("${goalList}"). Format: "X% of your [Goal Name] goal" or "A significant step toward [Goal Name]".
2. Calculate how many "fancy coffees" (at $6 each) this amount equals. Format: "X fancy coffees with friends".
3. Calculate how many weeks of groceries (at $100/week) this amount equals. Format: "X weeks of groceries".
4. Generate 1 "Pro" of buying this item (be ${userTone}, acknowledge it's nice but keep it brief).
5. Generate 1 "Con" of buying this item (financial reality check related to their struggles/goals).
6. Write a short, punchy 1-sentence message (max 20 words) persuading them to save this money instead. Match the '${userTone}' tone.

IMPORTANT: Return ONLY valid JSON. Do not include markdown formatting like \`\`\`json.
Structure:
{
  "alternatives": ["goal_calc", "coffee_calc", "grocery_calc"],
  "pro": "The pro text",
  "con": "The con text",
  "message": "The persuasive message"
}

    Summarize the item name to be concise (e.g. "Garmin Watch" instead of the full title).`;

    // Try models found in the user's available list
    const attempts = [
        { model: 'gemini-2.0-flash', version: 'v1beta' },
        { model: 'gemini-flash-latest', version: 'v1beta' },
        { model: 'gemini-pro-latest', version: 'v1beta' },
        { model: 'gemini-2.0-flash-exp', version: 'v1beta' },
        { model: 'gemini-1.5-flash', version: 'v1beta' }
    ];
    
    let geminiData = null;
    let usedModel = "";
    const modelErrors: string[] = [];

    for (const attempt of attempts) {
        try {
            console.log(`Attempting to use model: ${attempt.model} (${attempt.version})`);
            const geminiRes = await fetch(`https://generativelanguage.googleapis.com/${attempt.version}/models/${attempt.model}:generateContent?key=${geminiApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            const data = await geminiRes.json();
            
            if (geminiRes.ok && data.candidates && data.candidates.length > 0) {
                geminiData = data;
                usedModel = `${attempt.model} (${attempt.version})`;
                console.log(`Successfully generated content with model: ${usedModel}`);
                break; // Success!
            } else {
                console.warn(`Model ${attempt.model} failed:`, JSON.stringify(data));
                modelErrors.push(`${attempt.model} (${attempt.version}): ${JSON.stringify(data)}`);
            }
        } catch (e: any) {
            console.error(`Error calling model ${attempt.model}:`, e);
            modelErrors.push(`${attempt.model} Exception: ${e.message || String(e)}`);
        }
    }

    // If all generations failed, try to list available models to help debugging
    if (!geminiData) {
        try {
            console.log("All models failed. Listing available models...");
            const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`);
            const listData = await listRes.json();
            modelErrors.push(`AVAILABLE_MODELS_DEBUG: ${JSON.stringify(listData)}`);
        } catch (e: any) {
            modelErrors.push(`ListModels Failed: ${e.message || String(e)}`);
        }
    }
    
    // Default Fallback (only used if AI parsing fails completely)
    const shortName = item_name.length > 30 ? item_name.substring(0, 27) + "..." : item_name;
    let aiResponse: {
        alternatives: string[];
        pro: string;
        con: string;
        message: string;
        debug_error?: string | null;
        debug_raw?: string | null;
        used_model?: string | null;
    } = {
        alternatives: ["Invest in your future", "Save for a rainy day", "Treat yourself later"],
        pro: `This ${shortName} looks tempting!`,
        con: "But think about your financial goals.",
        message: "Is this purchase really worth it?",
        debug_error: null,
        debug_raw: null,
        used_model: null
    };

    if (geminiData && geminiData.candidates && geminiData.candidates[0].content) {
        const text = geminiData.candidates[0].content.parts[0].text.trim();
        console.log("Gemini Raw Response:", text); // Log for debugging

        // Robust JSON Extraction
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1) {
            const jsonText = text.substring(firstBrace, lastBrace + 1);
            try {
                aiResponse = JSON.parse(jsonText);
                aiResponse.used_model = usedModel;
            } catch (e: any) {
                console.error("JSON Parse Error:", e);
                aiResponse.debug_error = "JSON Parse Error: " + (e.message || String(e));
                aiResponse.debug_raw = text;
                aiResponse.used_model = usedModel;
            }
        } else {
             console.error("No JSON braces found in response");
             aiResponse.debug_error = "No JSON braces found";
             aiResponse.debug_raw = text;
             aiResponse.used_model = usedModel;
        }
    } else {
        console.error("All Gemini models failed or returned empty response");
        aiResponse.debug_error = "All Gemini models failed";
        aiResponse.debug_raw = JSON.stringify(modelErrors);
    }

    // 4. Call ElevenLabs API
    const elevenApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    let audioBase64 = null;

    // Map tone to stability settings
    let stability = 0.5;
    if (userTone.toLowerCase().includes("serious") || userTone.toLowerCase().includes("strict")) {
        stability = 0.8; // More stable, less expressive
    } else if (userTone.toLowerCase().includes("witty") || userTone.toLowerCase().includes("fun")) {
        stability = 0.3; // More expressive/variable
    }

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
                        stability: stability,
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
