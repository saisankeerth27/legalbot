import React from "react";
import type { Message } from "@/lib/chat-service";
import { Copy, Scale, User } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

const TypingIndicator = () => (
  <div className="flex items-center gap-1.5 px-4 py-2">
    <div className="h-2 w-2 rounded-full bg-primary animate-pulse-dot" />
    <div className="h-2 w-2 rounded-full bg-primary animate-pulse-dot" style={{ animationDelay: "0.2s" }} />
    <div className="h-2 w-2 rounded-full bg-primary animate-pulse-dot" style={{ animationDelay: "0.4s" }} />
    <span className="text-xs text-muted-foreground ml-2">LegalBot is typing...</span>
  </div>
);

const WelcomeScreen = () => (
  <div className="flex flex-col items-center justify-center h-full text-center px-6">
    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
      <Scale className="h-8 w-8 text-primary" />
    </div>
    <h2 className="font-display text-2xl font-bold text-foreground mb-2">
      Welcome to LegalBot
    </h2>
    <p className="text-muted-foreground max-w-md mb-8">
      Ask me anything about Indian laws — IPC, Constitution, Cyber Laws, Consumer Rights, Women Safety Laws, and more.
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
      {[
        "What are my rights if I'm arrested?",
        "Explain Section 498A IPC",
        "What is the Consumer Protection Act?",
        "How to file an RTI application?",
      ].map((q) => (
        <div
          key={q}
          className="px-4 py-3 rounded-xl border border-border bg-card text-sm text-foreground/80 hover:bg-secondary cursor-pointer transition-colors text-left"
        >
          {q}
        </div>
      ))}
    </div>
    <p className="text-xs text-muted-foreground mt-8">
      ⚠️ This is for informational purposes only and does not constitute legal advice.
    </p>
  </div>
);

const formatTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const ChatMessages: React.FC<ChatMessagesProps> = ({ messages, isLoading, messagesEndRef }) => {
  if (messages.length === 0 && !isLoading) {
    return <WelcomeScreen />;
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      {messages.map((msg) => (
        <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
          {msg.role === "assistant" && (
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
              <Scale className="h-4 w-4 text-primary" />
            </div>
          )}
          <div
            className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.role === "user"
                ? "bg-user-bubble text-foreground"
                : "bg-bot-bubble text-foreground"
            }`}
          >
            {msg.role === "assistant" ? (
              <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:mb-0.5 [&_strong]:text-primary [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            )}
            <div className="flex items-center justify-between mt-2 gap-2">
              <span className="text-[10px] text-muted-foreground">{formatTime(msg.created_at)}</span>
              {msg.role === "assistant" && (
                <button
                  onClick={() => copyToClipboard(msg.content)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          {msg.role === "user" && (
            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
              <User className="h-4 w-4 text-secondary-foreground" />
            </div>
          )}
        </div>
      ))}
      {isLoading && messages[messages.length - 1]?.role !== "assistant" && <TypingIndicator />}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatMessages;
