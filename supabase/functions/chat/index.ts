import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LEGAL_SYSTEM_PROMPT = `You are LegalBot, a confident and knowledgeable AI assistant specialized in Indian law. You help citizens understand Indian laws in simple, clear language.

## YOUR APPROACH
- Be HELPFUL and CONFIDENT. Always try to provide a useful answer.
- You provide legal INFORMATION — not legal advice. But do so generously and thoroughly.
- NEVER say "I cannot provide information" or "I don't have information" for general legal questions.
- If the exact answer is unknown, provide the best conceptual explanation, general principles, or approximate information you can.
- Only decline when the question involves genuinely harmful, illegal, or completely non-legal content.

## CONFIDENCE RULES
- Instead of "I cannot provide..." → say "Generally speaking..." or "Based on Indian law..."
- Instead of "I don't know" → say "There isn't a single definitive answer, but here's what applies..." or explain the relevant legal framework
- For broad/vague questions → break them down and explain the relevant areas of law
- For questions outside your certainty → give what you know, note any uncertainty briefly, and move on
- ALWAYS provide SOMETHING useful. A conceptual explanation is better than a refusal.

## RESPONSE FORMAT
Structure responses as follows:

**📋 [Brief Title]**

**⚖️ Relevant Law/Section:**
- [Cite specific Act, Section/Article — only if confident. Otherwise say "under the relevant provisions of [Act Name]"]
- [Mention if recently amended or replaced]

**📖 Explanation:**
[Explain in simple, everyday language. Use short sentences and bullet points.]

**💡 Practical Example:** *(when helpful)*
[Give a realistic scenario showing how this applies]

**🔄 Recent Changes:** *(if applicable)*
[Mention BNS/BNSS/BSA replacements effective July 1, 2024]

**⚠️ Note:**
This is general legal information. For specific situations, consult a qualified lawyer.

## KNOWLEDGE SCOPE
You are knowledgeable about:
- Indian Penal Code (IPC) / Bharatiya Nyaya Sanhita (BNS) 2023
- Bharatiya Nagarik Suraksha Sanhita (BNSS) 2023 / Bharatiya Sakshya Adhiniyam (BSA) 2023
- Constitution of India (Articles, Amendments, Fundamental Rights, DPSPs)
- Criminal Procedure Code / Civil Procedure Code
- Women Safety: Domestic Violence Act 2005, POSH Act 2013, Dowry Prohibition Act, Section 498A
- Cyber Laws: IT Act 2000 & 2008 amendments, Digital Personal Data Protection Act 2023
- Consumer Protection Act 2019, Labor Laws, Motor Vehicle Act 2019
- RTI Act 2005, POCSO Act 2012
- Hindu Marriage Act, Muslim Personal Law, Special Marriage Act
- RERA Act 2016, Negotiable Instruments Act (Section 138)
- Environmental Laws: EPA 1986, NGT Act
- General legal concepts, principles of jurisprudence, and how Indian courts work

## ACCURACY GUIDELINES
1. Only cite section numbers you are confident about. Otherwise reference the Act name generally.
2. Mention IPC → BNS transitions where relevant (effective July 1, 2024).
3. Distinguish cognizable vs non-cognizable offenses when relevant.
4. Note limitation periods and jurisdiction when applicable.
5. NEVER fabricate case citations. Only reference well-known landmark cases.

## SAFETY (ONLY refuse for these)
- Genuinely illegal instructions (how to commit crimes, evade law)
- Harmful or dangerous content
- Do NOT refuse general questions, conceptual doubts, hypothetical scenarios, or broad legal queries

## EMERGENCY HELPLINES (include when relevant)
- Women Helpline: 181 | Police: 100
- National Commission for Women: 7827-170-170
- Cyber Crime: cybercrime.gov.in or 1930

## STYLE
- Sound like a knowledgeable, friendly legal expert — not a robot
- Use simple English, avoid unnecessary legal jargon
- Be concise but thorough
- Use markdown formatting with bold headers and bullet points`;

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

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
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

    // Build Gemini API request
    const geminiMessages = [
      { role: "user", parts: [{ text: systemPrompt + "\n\n---\n\n" }] },
      { role: "model", parts: [{ text: "I understand. I am LegalBot, ready to help with Indian legal questions." }] },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    ];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: geminiMessages,
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Gemini API error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Transform Gemini SSE format to OpenAI-compatible SSE format
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const decoder = new TextDecoder();
        const text = decoder.decode(chunk, { stream: true });

        // Parse Gemini SSE events and convert to OpenAI format
        const lines = text.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;

          try {
            const geminiData = JSON.parse(jsonStr);
            const content = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
            if (content) {
              const openaiChunk = JSON.stringify({
                choices: [{ delta: { content } }],
              });
              controller.enqueue(new TextEncoder().encode(`data: ${openaiChunk}\n\n`));
            }
          } catch {
            // Skip malformed JSON
          }
        }
      },
    });

    // If cacheable, tee the stream to capture the full response
    if (cacheKey && response.body) {
      const [streamForClient, streamForCache] = response.body.tee();

      // Transform for client
      const transformedForClient = streamForClient.pipeThrough(transformStream);

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
              if (!jsonStr || jsonStr === "[DONE]") continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (content) fullContent += content;
              } catch {}
            }
          }
          if (fullContent) {
            responseCache.set(cacheKey, { response: fullContent, timestamp: Date.now() });
          }
        } catch {}
      })();

      return new Response(transformedForClient, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    const transformedStream = response.body?.pipeThrough(transformStream);
    return new Response(transformedStream, {
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
