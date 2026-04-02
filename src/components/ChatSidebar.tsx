import React from "react";
import { Plus, Trash2, MessageSquare, Scale, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Conversation } from "@/lib/chat-service";

interface ChatSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (convo: Conversation) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  onClose?: () => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
  onClose,
}) => {
  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo + close button */}
      <div className="p-4 flex items-center justify-between border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Scale className="h-6 w-6 text-primary" />
          <span className="font-display text-base font-semibold text-foreground">LegalBot</span>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* New chat button */}
      <div className="p-3">
        <Button
          onClick={onNewChat}
          className="w-full justify-start gap-2"
          variant="outline"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 space-y-1">
        {conversations.map((convo) => (
          <div
            key={convo.id}
            className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors active:scale-[0.98] ${
              activeId === convo.id
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            }`}
            onClick={() => onSelect(convo)}
          >
            <MessageSquare className="h-4 w-4 flex-shrink-0 opacity-60" />
            <span className="text-sm truncate flex-1">{convo.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(convo.id);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-destructive/20 touch-manipulation"
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        <p className="text-xs text-muted-foreground text-center">
          Indian Legal Information Assistant
        </p>
      </div>
    </div>
  );
};

export default ChatSidebar;
