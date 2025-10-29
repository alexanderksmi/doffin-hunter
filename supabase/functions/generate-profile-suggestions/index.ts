import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyName, domain, industry } = await req.json();
    
    console.log('Generating suggestions for:', { companyName, domain, industry });
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const prompt = `Du får firmanavn, domene og bransje for ett selskap. Bruk kun offentlig kjent og plausibel informasjon om selskapet og bransjen, og vær konservativ.

Selskap: ${companyName}
Domene: ${domain}
Bransje: ${industry}

Foreslå:
- 2-3 minimumskrav som må være til stede for at et anbud er relevant for dette selskapet
- 3-6 støtteord med små heltallsvekter mellom +1 og +3
- 1-2 negativord med heltallsvekter mellom −1 og −3
- 2-3 CPV-koder som startpunkter

Ikke spekuler i proprietære detaljer, ikke overfyll med ord, og prioriter presisjon fremfor bredde. Hvis du er usikker, velg færre og mer generelle termer for bransjen. Språket skal være nøkternt, norskt og B2B-vennlig.

Svar BARE med JSON i dette formatet:
{
  "minimumRequirements": ["ord1", "ord2"],
  "supportKeywords": [{"keyword": "ord", "weight": 2}],
  "negativeKeywords": [{"keyword": "ord", "weight": -2}],
  "cpvCodes": [{"code": "12345678", "weight": 2}]
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { 
            role: "system", 
            content: "Du er en ekspert på norske offentlige anbud og CPV-koder. Du gir konservative, presise forslag basert kun på offentlig kjent informasjon. Hold deg til maksimalt 2-3 minimumskrav, 3-6 støtteord, 1-2 negativord, og 2-3 CPV-koder. Prioriter kvalitet over kvantitet."
          },
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), 
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to continue." }), 
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    console.log('AI Response:', content);
    
    // Extract JSON from response (handle markdown code blocks if present)
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.replace(/```\n?/g, '');
    }
    
    const suggestions = JSON.parse(jsonContent);

    return new Response(
      JSON.stringify({ suggestions }), 
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error) {
    console.error("Error in generate-profile-suggestions:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
