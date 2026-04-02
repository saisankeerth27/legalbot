import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LEGAL_SYSTEM_PROMPT = `You are LegalBot, an AI legal information assistant specialized in Indian law. You provide clear, simple, and structured legal information.

IMPORTANT RULES:
1. You ONLY provide legal INFORMATION, never legal ADVICE
2. Always structure your responses in this format:
   - **📋 Title**: Brief title of the legal topic
   - **⚖️ Relevant Law/Section**: Cite specific laws, sections, articles
   - **📖 Explanation**: Simple language explanation anyone can understand
   - **💡 Example**: A practical example if applicable
   - **⚠️ Disclaimer**: "This is for informational purposes only and does not constitute legal advice. Please consult a qualified lawyer for specific legal matters."
3. Your knowledge covers:
   - Indian Penal Code (IPC) / Bharatiya Nyaya Sanhita (BNS)
   - Constitution of India (Articles & Amendments)
   - Women Safety Laws (Domestic Violence Act, POSH Act, Dowry Prohibition Act, etc.)
   - Cyber Laws (IT Act 2000, amendments)
   - Consumer Protection Act 2019
   - Labor Laws (Factories Act, Minimum Wages Act, etc.)
   - Motor Vehicle Act, RTI Act, POCSO Act, and more
4. If you're unsure about specific details, say so clearly
5. Filter and refuse to answer harmful or illegal queries
6. If the user writes in Hindi or Telugu, respond in that language while keeping legal terms in English
7. Be concise but thorough. Use bullet points for clarity.
8. Always mention if a law has been recently amended or replaced.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, language } = await req.json();
    
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Messages array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt = LEGAL_SYSTEM_PROMPT;
    if (language && language !== "English") {
      systemPrompt += `\n\nIMPORTANT: The user is communicating in ${language}. Respond in ${language} while keeping legal section numbers and act names in English for accuracy.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
