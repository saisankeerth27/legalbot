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
import { Menu, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";

const LANGUAGES = ["English", "Hindi", "Telugu"] as const;
type Language = (typeof LANGUAGES)[number];

const Index = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [language, setLanguage] = useState<Language>("English");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const sessionId = useRef(getSessionId());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    loadConversations();
  }, []);

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
    }
  };

  const selectConversation = (convo: Conversation) => {
    setActiveConversationId(convo.id);
    setLanguage(convo.language as Language);
    loadMessages(convo.id);
  };

  const handleNewChat = async () => {
    try {
      const convo = await createConversation(sessionId.current, language);
      setConversations((prev) => [convo, ...prev]);
      setActiveConversationId(convo.id);
      setMessages([]);
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
    if (!input.trim() || isLoading) return;

    let conversationId = activeConversationId;

    if (!conversationId) {
      try {
        const convo = await createConversation(sessionId.current, language);
        setConversations((prev) => [convo, ...prev]);
        conversationId = convo.id;
        setActiveConversationId(convo.id);
      } catch {
        toast.error("Failed to create conversation");
        return;
      }
    }

    // Save and display user message
    const userMsg = await saveMessage(conversationId, "user", input.trim());
    setMessages((prev) => [...prev, userMsg]);

    // Auto-title from first message
    if (messages.length === 0) {
      const title = input.trim().slice(0, 50) + (input.trim().length > 50 ? "..." : "");
      updateConversationTitle(conversationId, title);
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, title } : c))
      );
    }

    setIsLoading(true);
    let assistantContent = "";

    const allMessages = [...messages, { role: "user" as const, content: input.trim(), id: userMsg.id, created_at: userMsg.created_at }];

    await streamChat({
      messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
      language,
      onDelta: (chunk) => {
        assistantContent += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && !last.id.startsWith("db-")) {
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
        if (assistantContent && conversationId) {
          const saved = await saveMessage(conversationId, "assistant", assistantContent);
          setMessages((prev) =>
            prev.map((m, i) =>
              i === prev.length - 1 ? { ...saved } : m
            )
          );
        }
      },
      onError: (error) => {
        setIsLoading(false);
        toast.error(error);
      },
    });
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "w-72" : "w-0"
        } transition-all duration-300 overflow-hidden flex-shrink-0`}
      >
        <ChatSidebar
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={selectConversation}
          onNewChat={handleNewChat}
          onDelete={handleDeleteChat}
        />
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex-shrink-0"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              <h1 className="font-display text-lg font-semibold text-foreground">LegalBot</h1>
            </div>
          </div>
          <LanguageSelector language={language} onChange={setLanguage} />
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <ChatMessages
            messages={messages}
            isLoading={isLoading}
            messagesEndRef={messagesEndRef}
          />
        </div>

        {/* Input */}
        <ChatInput onSend={handleSend} isLoading={isLoading} language={language} />
      </div>
    </div>
  );
};

export default Index;
