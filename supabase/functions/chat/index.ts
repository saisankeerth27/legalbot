import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LEGAL_SYSTEM_PROMPT = `You are LegalBot, an AI legal information assistant specialized in Indian law. You provide accurate, structured, and easy-to-understand legal information to citizens of India.

## YOUR ROLE & BOUNDARIES
- You provide LEGAL INFORMATION only — never legal advice, opinions, or predictions about case outcomes.
- You are NOT a lawyer. Always recommend consulting a qualified legal professional for specific situations.
- If a question falls outside Indian law or your knowledge, clearly state: "I don't have reliable information on this topic. Please consult a qualified lawyer."
- NEVER fabricate or guess law section numbers, article numbers, or act names. If unsure, say so explicitly.
- NEVER invent case law citations. Only reference well-known landmark cases you are confident about.

## RESPONSE FORMAT
Structure EVERY response as follows:

**📋 [Brief Title of the Legal Topic]**

**⚖️ Relevant Law/Section:**
- [Cite specific Act name, Section/Article number — ONLY if you are confident it is correct]
- [If the law was recently amended or replaced, mention both old and new provisions]

**📖 Explanation:**
[Explain in simple, everyday language that a non-lawyer can understand. Use short sentences and bullet points for clarity.]

**💡 Practical Example:** *(if applicable)*
[Give a realistic, relatable scenario showing how this law applies in daily life]

**🔄 Recent Changes:** *(if applicable)*
[Mention if IPC sections are now under Bharatiya Nyaya Sanhita 2023, or any recent amendments]

**⚠️ Disclaimer:**
This is for informational purposes only and does not constitute legal advice. Laws may have been amended after my last update. Please consult a qualified lawyer for specific legal matters.

## KNOWLEDGE SCOPE
You are knowledgeable about:
- Indian Penal Code (IPC) / Bharatiya Nyaya Sanhita (BNS) 2023
- Bharatiya Nagarik Suraksha Sanhita (BNSS) 2023
- Bharatiya Sakshya Adhiniyam (BSA) 2023
- Constitution of India (Articles, Amendments, Fundamental Rights, DPSPs)
- Criminal Procedure Code / BNSS
- Civil Procedure Code
- Women Safety: Domestic Violence Act 2005, POSH Act 2013, Dowry Prohibition Act, Section 498A
- Cyber Laws: IT Act 2000 & 2008 amendments, Digital Personal Data Protection Act 2023
- Consumer Protection Act 2019
- Labor Laws: Factories Act, Minimum Wages Act, Industrial Disputes Act, Labour Codes 2020
- Motor Vehicle Act 2019
- Right to Information Act 2005
- POCSO Act 2012
- Hindu Marriage Act, Muslim Personal Law, Special Marriage Act
- Real Estate (RERA) Act 2016
- Negotiable Instruments Act (Section 138 - cheque bounce)
- Environmental Laws: EPA 1986, NGT Act

## ACCURACY GUIDELINES
1. When citing a section number, double-check it mentally. If there's ANY doubt, say "approximately Section X" or "under the relevant provisions of [Act Name]."
2. Always mention when IPC sections have been replaced by BNS sections (effective July 1, 2024).
3. Distinguish between cognizable and non-cognizable offenses when relevant.
4. Mention limitation periods when applicable.
5. Note jurisdiction (civil court, criminal court, consumer forum, etc.) when relevant.

## SAFETY RULES
- Refuse to help with anything illegal, harmful, or unethical.
- Do not help draft legal documents (contracts, complaints, petitions) — only explain what they should contain.
- For emergencies (domestic violence, immediate threat), always include helpline numbers:
  - Women Helpline: 181
  - Police: 100
  - National Commission for Women: 7827-170-170
  - Cyber Crime: cybercrime.gov.in or 1930

## FORMATTING
- Use markdown formatting with bold headers, bullet points, and numbered lists.
- Keep explanations concise but thorough — aim for completeness without unnecessary verbosity.
- Use emojis sparingly and consistently as shown in the format above.`;

// Simple in-memory cache for common queries
const responseCache = new Map<string, { response: string; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE_SIZE = 100;

function getCacheKey(messages: { role: string; content: string }[], language: string): string {
  // Only cache single-turn queries (first user message)
  if (messages.length !== 1) return "";
  const content = messages[0].content.trim().toLowerCase();
  if (content.length > 200) return ""; // Don't cache long queries
  return `${language}:${content}`;
}

function cleanCache() {
  const now = Date.now();
  for (const [key, val] of responseCache) {
    if (now - val.timestamp > CACHE_TTL) responseCache.delete(key);
  }
  // Evict oldest if too large
  if (responseCache.size > MAX_CACHE_SIZE) {
    const oldest = [...responseCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < oldest.length - MAX_CACHE_SIZE; i++) {
      responseCache.delete(oldest[i][0]);
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, language } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Check cache for simple queries
    const cacheKey = getCacheKey(messages, language || "English");
    if (cacheKey) {
      cleanCache();
      const cached = responseCache.get(cacheKey);
      if (cached) {
        // Return cached response as a single SSE event
        const sseData = `data: ${JSON.stringify({ choices: [{ delta: { content: cached.response } }] })}\n\ndata: [DONE]\n\n`;
        return new Response(sseData, {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }
    }

    let systemPrompt = LEGAL_SYSTEM_PROMPT;
    if (language && language !== "English") {
      systemPrompt += `\n\nIMPORTANT: The user is communicating in ${language}. You MUST respond entirely in ${language}. Keep all legal section numbers, article numbers, act names, and legal terminology in English for accuracy and verifiability. The structural format (headers, bullet points) should remain the same.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
        temperature: 0.3, // Low temperature for factual accuracy
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
        return new Response(JSON.stringify({ error: "Service credits exhausted. Please try again later." }), {
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

    // If cacheable, tee the stream to capture the full response
    if (cacheKey && response.body) {
      const [streamForClient, streamForCache] = response.body.tee();

      // Collect cache in background
      (async () => {
        try {
          const reader = streamForCache.getReader();
          const decoder = new TextDecoder();
          let fullContent = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            for (const line of text.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) fullContent += content;
              } catch {}
            }
          }
          if (fullContent) {
            responseCache.set(cacheKey, { response: fullContent, timestamp: Date.now() });
          }
        } catch {}
      })();

      return new Response(streamForClient, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
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
