import React from "react";
import type { Message } from "@/lib/chat-service";
import { Copy, Scale, User } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onSuggestionClick?: (question: string) => void;
}

const TypingIndicator = () => (
  <div className="flex items-start gap-2 sm:gap-3">
    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
      <Scale className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
    </div>
    <div className="bg-bot-bubble rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3">
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full bg-primary animate-pulse-dot" />
        <div className="h-2 w-2 rounded-full bg-primary animate-pulse-dot" style={{ animationDelay: "0.2s" }} />
        <div className="h-2 w-2 rounded-full bg-primary animate-pulse-dot" style={{ animationDelay: "0.4s" }} />
        <span className="text-xs text-muted-foreground ml-2">LegalBot is thinking...</span>
      </div>
    </div>
  </div>
);

const SUGGESTIONS = [
  "What are my rights if I'm arrested?",
  "Explain Section 498A IPC",
  "What is the Consumer Protection Act?",
  "How to file an RTI application?",
];

const WelcomeScreen: React.FC<{ onSuggestionClick?: (q: string) => void }> = ({ onSuggestionClick }) => (
  <div className="flex flex-col items-center justify-center h-full text-center px-4 sm:px-6">
    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 sm:mb-6">
      <Scale className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
    </div>
    <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground mb-2">
      Welcome to LegalBot
    </h2>
    <p className="text-sm sm:text-base text-muted-foreground max-w-md mb-6 sm:mb-8">
      Ask me anything about Indian laws — IPC, Constitution, Cyber Laws, Consumer Rights, Women Safety Laws, and more.
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 max-w-lg w-full">
      {SUGGESTIONS.map((q) => (
        <button
          key={q}
          onClick={() => onSuggestionClick?.(q)}
          className="px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-border bg-card text-xs sm:text-sm text-foreground/80 hover:bg-secondary active:scale-[0.98] cursor-pointer transition-all text-left touch-manipulation"
        >
          {q}
        </button>
      ))}
    </div>
    <p className="text-[10px] sm:text-xs text-muted-foreground mt-6 sm:mt-8">
      This is for informational purposes only and does not constitute legal advice.
    </p>
  </div>
);

const formatTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const ChatMessages: React.FC<ChatMessagesProps> = ({ messages, isLoading, messagesEndRef, onSuggestionClick }) => {
  if (messages.length === 0 && !isLoading) {
    return <WelcomeScreen onSuggestionClick={onSuggestionClick} />;
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="max-w-3xl mx-auto py-4 sm:py-6 px-3 sm:px-4 space-y-4 sm:space-y-6">
      {messages.map((msg) => (
        <div key={msg.id} className={`flex gap-2 sm:gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
          {msg.role === "assistant" && (
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
              <Scale className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
            </div>
          )}
          <div
            className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 ${
              msg.role === "user"
                ? "bg-user-bubble text-foreground"
                : "bg-bot-bubble text-foreground"
            }`}
          >
            {msg.role === "assistant" ? (
              <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:mb-0.5 [&_strong]:text-primary [&_h1]:text-base sm:[&_h1]:text-lg [&_h2]:text-sm sm:[&_h2]:text-base [&_h3]:text-xs sm:[&_h3]:text-sm text-xs sm:text-sm">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-xs sm:text-sm whitespace-pre-wrap">{msg.content}</p>
            )}
            <div className="flex items-center justify-between mt-1.5 sm:mt-2 gap-2">
              <span className="text-[9px] sm:text-[10px] text-muted-foreground">{formatTime(msg.created_at)}</span>
              {msg.role === "assistant" && !msg.id.startsWith("streaming-") && (
                <button
                  onClick={() => copyToClipboard(msg.content)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 touch-manipulation"
                >
                  <Copy className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </button>
              )}
            </div>
          </div>
          {msg.role === "user" && (
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
              <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-secondary-foreground" />
            </div>
          )}
        </div>
      ))}
      {isLoading && <TypingIndicator />}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatMessages;
