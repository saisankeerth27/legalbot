import { supabase } from "@/integrations/supabase/client";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type Conversation = {
  id: string;
  session_id: string;
  title: string;
  language: string;
  created_at: string;
  updated_at: string;
};

export function getSessionId(): string {
  let sessionId = localStorage.getItem("legalbot_session_id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem("legalbot_session_id", sessionId);
  }
  return sessionId;
}

export async function getConversations(sessionId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("session_id", sessionId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createConversation(sessionId: string, language: string): Promise<Conversation> {
  const { data, error } = await supabase
    .from("conversations")
    .insert({ session_id: sessionId, language, title: "New Chat" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteConversation(id: string): Promise<void> {
  const { error } = await supabase.from("conversations").delete().eq("id", id);
  if (error) throw error;
}

export async function updateConversationTitle(id: string, title: string): Promise<void> {
  const { error } = await supabase.from("conversations").update({ title }).eq("id", id);
  if (error) throw error;
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as Message[];
}

export async function saveMessage(conversationId: string, role: "user" | "assistant", content: string): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, role, content })
    .select()
    .single();
  if (error) throw error;
  return data as Message;
}

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;

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

export async function streamChat({
  messages,
  language,
  onDelta,
  onDone,
  onError,
}: {
  messages: { role: string; content: string }[];
  language: string;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}) {
  try {
    let systemPrompt = LEGAL_SYSTEM_PROMPT;
    if (language && language !== "English") {
      systemPrompt += `\n\nIMPORTANT: The user is communicating in ${language}. You MUST respond entirely in ${language}. Keep all legal section numbers, article numbers, act names, and legal terminology in English for accuracy and verifiability. The structural format (headers, bullet points) should remain the same.`;
    }

    const geminiMessages = [
      { role: "user", parts: [{ text: systemPrompt + "\n\n---\n\n" }] },
      { role: "model", parts: [{ text: "I understand. I am LegalBot, ready to help with Indian legal questions." }] },
      ...messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    ];

    const resp = await fetch(GEMINI_API_URL, {
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
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Gemini API error:", resp.status, errText);
      onError(`API error: ${resp.status}`);
      return;
    }

    if (!resp.body) {
      onError("No response body");
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          onDone();
          return;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (content) onDelta(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    onDone();
  } catch (e) {
    onError(e instanceof Error ? e.message : "Unknown error");
  }
}
