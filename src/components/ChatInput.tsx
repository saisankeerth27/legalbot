import React, { useState, useRef, useEffect } from "react";
import { Send, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  language: string;
}

const placeholders: Record<string, string> = {
  English: "Ask about Indian laws...",
  Hindi: "भारतीय कानूनों के बारे में पूछें...",
  Telugu: "భారతీయ చట్టాల గురించి అడగండి...",
};

const ChatInput: React.FC<ChatInputProps> = ({ onSend, isLoading, language }) => {
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const handleSubmit = () => {
    if (input.trim() && !isLoading) {
      onSend(input);
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const langMap: Record<string, string> = {
    English: "en-IN",
    Hindi: "hi-IN",
    Telugu: "te-IN",
  };

  const toggleVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser");
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = langMap[language] || "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => (prev ? prev + " " + transcript : transcript));
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech error:", event.error);
      if (event.error !== "aborted") {
        toast.error("Voice input failed. Please try again.");
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  return (
    <div className="border-t border-border bg-card p-2.5 sm:p-4 flex-shrink-0">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end gap-1.5 sm:gap-2 bg-secondary rounded-2xl px-3 sm:px-4 py-2 sm:py-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleVoice}
            className={`h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 touch-manipulation ${
              isListening ? "text-destructive bg-destructive/10" : "text-muted-foreground"
            }`}
            title={isListening ? "Stop listening" : "Voice input"}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholders[language] || placeholders.English}
            rows={1}
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground resize-none outline-none text-sm min-h-[24px] max-h-[120px] py-1"
            disabled={isLoading}
          />
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl flex-shrink-0 touch-manipulation"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[9px] sm:text-[10px] text-muted-foreground text-center mt-1.5 sm:mt-2">
          LegalBot provides information only, not legal advice. Consult a qualified lawyer for specific matters.
        </p>
      </div>
    </div>
  );
};

export default ChatInput;
