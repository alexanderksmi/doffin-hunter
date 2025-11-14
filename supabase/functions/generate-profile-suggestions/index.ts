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

    // Fetch the website content
    let websiteContent = "";
    try {
      console.log(`Fetching website: https://${domain}`);
      const websiteResponse = await fetch(`https://${domain}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Anbudspartner/1.0; +https://anbudspartner.no)'
        },
        redirect: 'follow'
      });
      
      if (websiteResponse.ok) {
        const html = await websiteResponse.text();
        // Extract text from HTML (simple approach - remove script and style tags, then strip HTML)
        websiteContent = html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 8000); // Limit to first 8000 characters
        
        console.log(`Successfully fetched ${websiteContent.length} characters from ${domain}`);
      } else {
        console.warn(`Failed to fetch ${domain}: ${websiteResponse.status}`);
      }
    } catch (fetchError) {
      console.warn(`Error fetching website ${domain}:`, fetchError);
      // Continue without website content
    }

    const prompt = websiteContent 
      ? `Du får firmanavn, domene, bransje OG innhold fra selskapets nettside. Analyser nettsiden nøye for å forstå hva selskapet faktisk tilbyr og markedsfører seg som.

Selskap: ${companyName}
Domene: ${domain}
Bransje: ${industry}

INNHOLD FRA NETTSIDEN:
${websiteContent}

Basert på nettsidens innhold, foreslå:

MINIMUMSKRAV (2-3 stk): Dette skal være de VIKTIGSTE ordene/begrepene som går igjen på nettsiden deres - hva de faktisk markedsfører seg som. For eksempel hvis de skriver mye om "rådgivning" og "prosjektledelse", skal dette være minimumskrav. Dette er harde dørvakter som MÅ være tilstede.

STØTTEORD (3-6 stk): Andre viktige ord/begreper som beskriver deres produkter, tjenester eller kompetanseområder. Disse øker relevans. Bruk vekter +1 til +3.

NEGATIVORD (1-2 stk): Ord som indikerer at anbudet IKKE er relevant for dem. Bruk vekter -1 til -3.

CPV-KODER (2-3 stk): Velg relevante CPV-koder basert på hva selskapet faktisk tilbyr.

Vær SPESIFIKK basert på nettsidens faktiske innhold. Språket skal være nøkternt, norskt og B2B-vennlig.

Svar BARE med JSON i dette formatet:
{
  "minimumRequirements": ["ord1", "ord2"],
  "supportKeywords": [{"keyword": "ord", "weight": 2}],
  "negativeKeywords": [{"keyword": "ord", "weight": -2}],
  "cpvCodes": [{"code": "12345678", "weight": 2}]
}`
      : `Du får firmanavn, domene og bransje for ett selskap. Nettsiden kunne ikke hentes, så bruk kun offentlig kjent informasjon om bransjen.

Selskap: ${companyName}
Domene: ${domain}
Bransje: ${industry}

Foreslå konservative, generelle søkeord basert på bransjen:
- 2-3 minimumskrav som må være til stede for at et anbud er relevant
- 3-6 støtteord med små heltallsvekter mellom +1 og +3
- 1-2 negativord med heltallsvekter mellom −1 og −3
- 2-3 CPV-koder som startpunkter

Vær konservativ og hold deg til bransje-generelle termer. Språket skal være nøkternt, norskt og B2B-vennlig.

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
