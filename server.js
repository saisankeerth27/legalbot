import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODELS = ["gemini-3.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-flash"];
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

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

app.get("/health", (req, res) => {
  res.json({ status: "ok", model: GEMINI_MODELS[0], keySet: !!GEMINI_API_KEY });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, language } = req.body;
    console.log("Received messages:", messages?.length, "language:", language);

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Messages array is required" });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured on server" });
    }

    let systemPrompt = LEGAL_SYSTEM_PROMPT;
    if (language && language !== "English") {
      systemPrompt += `\n\nIMPORTANT: The user is communicating in ${language}. You MUST respond entirely in ${language}. Keep all legal section numbers, article numbers, act names, and legal terminology in English for accuracy and verifiability.`;
    }

    const geminiMessages = [
      { role: "user", parts: [{ text: systemPrompt + "\n\n---\n\n" }] },
      { role: "model", parts: [{ text: "I understand. I am LegalBot, ready to help with Indian legal questions." }] },
      ...messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content || "" }],
      })),
    };

    const requestBody = {
      contents: geminiMessages,
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
    };

    let resp = null;
    for (const model of GEMINI_MODELS) {
      const url = `${GEMINI_API_BASE}/${model}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;
      resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (resp.ok) break;
      console.log(`Model ${model} failed:`, resp.status);
      resp = null;
    }

    if (!resp) {
      return res.status(503).json({ error: "AI service temporarily unavailable" });
    }

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Gemini error:", resp.status, errText);
      return res.status(502).json({ error: "AI service error" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();

    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { res.end(); return; }
        res.write(decoder.decode(value, { stream: true }));
      }
    };

    pump().catch((err) => { console.error("Stream error:", err); res.end(); });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Internal server error: " + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`LegalBot server running on port ${PORT}`);
});
