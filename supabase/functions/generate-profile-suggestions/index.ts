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

    const prompt = `Du er en ekspert på offentlige anbud i Norge. Basert på følgende selskapsinformasjon, skal du foreslå nøkkelord og kriterier som kan brukes til å filtrere relevante anbud.

Selskap: ${companyName}
Domene: ${domain}
Bransje: ${industry}

Vær konservativ - foreslå kun det mest relevante. Oppgi:
- 2-3 minimumskrav (ord som ALLTID må være med)
- 3-6 støtteord (positive ord med vekt 1-3)
- 1-2 negativord (ord som tyder på irrelevante anbud, med negativ vekt)
- 2-3 CPV-koder (Common Procurement Vocabulary koder)

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
            content: "Du er en ekspert på norske offentlige anbud og CPV-koder. Du gir konservative, presise forslag."
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
