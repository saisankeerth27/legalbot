import React, { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  type Message,
  type Conversation,
  getSessionId,
  getConversations,
  createConversation,
  deleteConversation,
  updateConversationTitle,
  getMessages,
  saveMessage,
  streamChat,
} from "@/lib/chat-service";
import ChatSidebar from "@/components/ChatSidebar";
import ChatMessages from "@/components/ChatMessages";
import ChatInput from "@/components/ChatInput";
import LanguageSelector from "@/components/LanguageSelector";
import ThemeToggle from "@/components/ThemeToggle";
import { Menu, Scale, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Language = "English" | "Hindi" | "Telugu";

const Index = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [language, setLanguage] = useState<Language>("English");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const sessionId = useRef(getSessionId());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      setIsMobile(w < 768);
      setIsTablet(w >= 768 && w < 1024);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!isMobile && !isTablet) {
      setSidebarOpen(true);
    } else {
      setSidebarOpen(false);
    }
  }, [isMobile, isTablet]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    try {
      const convos = await getConversations(sessionId.current);
      setConversations(convos);
      if (convos.length > 0) {
        setActiveConversationId(convos[0].id);
        setLanguage(convos[0].language as Language);
        try {
          const msgs = await getMessages(convos[0].id);
          setMessages(msgs);
        } catch {
          console.error("Failed to load initial messages");
        }
      }
    } catch (err) {
      console.error("Failed to initialize:", err);
      toast.error("Failed to load conversations. Please refresh.");
    } finally {
      setIsInitializing(false);
    }
  };

  const loadConversations = async () => {
    try {
      const convos = await getConversations(sessionId.current);
      setConversations(convos);
    } catch {
      console.error("Failed to load conversations");
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const msgs = await getMessages(conversationId);
      setMessages(msgs);
    } catch {
      console.error("Failed to load messages");
      toast.error("Failed to load messages");
    }
  };

  const selectConversation = (convo: Conversation) => {
    setActiveConversationId(convo.id);
    setLanguage(convo.language as Language);
    loadMessages(convo.id);
    if (isMobile) setSidebarOpen(false);
  };

  const handleNewChat = async () => {
    try {
      const convo = await createConversation(sessionId.current, language);
      setConversations((prev) => [convo, ...prev]);
      setActiveConversationId(convo.id);
      setMessages([]);
      if (isMobile) setSidebarOpen(false);
    } catch {
      toast.error("Failed to create new chat");
    }
  };

  const handleDeleteChat = async (id: string) => {
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
      }
    } catch {
      toast.error("Failed to delete chat");
    }
  };

  const handleSend = async (input: string) => {
    if (!input.trim() || isLoading || loadingRef.current) return;
    loadingRef.current = true;

    let conversationId = activeConversationId;

    if (!conversationId) {
      try {
        const convo = await createConversation(sessionId.current, language);
        setConversations((prev) => [convo, ...prev]);
        conversationId = convo.id;
        setActiveConversationId(convo.id);
      } catch {
        toast.error("Failed to create conversation");
        loadingRef.current = false;
        return;
      }
    }

    let userMsg: Message;
    try {
      userMsg = await saveMessage(conversationId, "user", input.trim());
    } catch {
      toast.error("Failed to save message");
      loadingRef.current = false;
      return;
    }

    setMessages((prev) => [...prev, userMsg]);

    if (messages.length === 0) {
      const title = input.trim().slice(0, 50) + (input.trim().length > 50 ? "..." : "");
      updateConversationTitle(conversationId, title).catch(() => {});
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, title } : c))
      );
    }

    setIsLoading(true);
    let assistantContent = "";

    const allMessages = [
      ...messages,
      { role: "user" as const, content: input.trim(), id: userMsg.id, created_at: userMsg.created_at },
    ];

    await streamChat({
      messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
      language,
      onDelta: (chunk) => {
        assistantContent += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && last.id.startsWith("streaming-")) {
            return prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: assistantContent } : m
            );
          }
          return [
            ...prev,
            {
              id: "streaming-" + Date.now(),
              role: "assistant" as const,
              content: assistantContent,
              created_at: new Date().toISOString(),
            },
          ];
        });
      },
      onDone: async () => {
        setIsLoading(false);
        loadingRef.current = false;
        if (assistantContent && conversationId) {
          try {
            const saved = await saveMessage(conversationId, "assistant", assistantContent);
            setMessages((prev) =>
              prev.map((m, i) => (i === prev.length - 1 ? { ...saved } : m))
            );
          } catch {
            console.error("Failed to save assistant message");
          }
        }
      },
      onError: (error) => {
        setIsLoading(false);
        loadingRef.current = false;
        toast.error(error);
        setMessages((prev) => prev.filter((m) => !m.id.startsWith("streaming-")));
      },
    });
  };

  const showOverlay = sidebarOpen && (isMobile || isTablet);

  if (isInitializing) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center animate-pulse">
            <Scale className="h-6 w-6 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Loading LegalBot...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden relative">
      {showOverlay && (
        <div
          className="fixed inset-0 bg-black/50 z-30 transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          ${isMobile || isTablet
            ? "fixed inset-y-0 left-0 z-40 w-72 transform transition-transform duration-300 ease-in-out"
            : "relative flex-shrink-0 transition-all duration-300"
          }
          ${isMobile || isTablet
            ? sidebarOpen ? "translate-x-0" : "-translate-x-full"
            : sidebarOpen ? "w-72" : "w-0"
          }
          ${!isMobile && !isTablet && !sidebarOpen ? "overflow-hidden" : ""}
        `}
      >
        <div className="h-full w-72">
          <ChatSidebar
            conversations={conversations}
            activeId={activeConversationId}
            onSelect={selectConversation}
            onNewChat={handleNewChat}
            onDelete={handleDeleteChat}
            onClose={isMobile || isTablet ? () => setSidebarOpen(false) : undefined}
          />
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-border bg-card flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex-shrink-0 h-9 w-9 sm:h-10 sm:w-10"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Scale className="h-5 w-5 text-primary" />
              <h1 className="font-display text-base sm:text-lg font-semibold text-foreground">LegalBot</h1>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <LanguageSelector language={language} onChange={(l) => setLanguage(l as Language)} />
            <ThemeToggle />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <ChatMessages
            messages={messages}
            isLoading={isLoading}
            messagesEndRef={messagesEndRef}
            onSuggestionClick={handleSend}
          />
        </div>

        <ChatInput onSend={handleSend} isLoading={isLoading} language={language} />
      </div>
    </div>
  );
};

export default Index;
