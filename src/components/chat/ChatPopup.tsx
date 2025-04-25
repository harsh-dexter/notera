import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Send, Bot, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
// Import the API service function
import { api } from "@/services/api";

interface ChatPopupProps {
  meetingId: string;
  onClose: () => void;
}

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
}

export function ChatPopup({ meetingId, onClose }: ChatPopupProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Function to scroll to the bottom of the chat messages
  const scrollToBottom = () => {
    setTimeout(() => { // Timeout ensures DOM has updated
        const scrollViewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollViewport) {
            scrollViewport.scrollTop = scrollViewport.scrollHeight;
        }
    }, 0);
  };

  // Scroll to bottom whenever messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const handleSendMessage = async () => {
    const userQuery = inputValue.trim();
    if (!userQuery || isLoading) return;

    // Add user message to state
    const newUserMessage: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: userQuery,
    };
    setMessages((prev) => [...prev, newUserMessage]);
    setInputValue(""); // Clear input
    setIsLoading(true); // Show loading indicator

    // Add placeholder AI message while waiting
     const aiPlaceholderMessage: Message = {
      id: `ai-loading-${Date.now()}`,
      sender: "ai",
      text: "...", // Placeholder text or spinner icon
    };
    setMessages((prev) => [...prev, aiPlaceholderMessage]);
    scrollToBottom(); // Scroll after adding placeholder

    try {
      // Call backend API
      const response = await api.queryChat(meetingId, userQuery);
      const aiResponseText = response.answer;

      // Replace placeholder with actual AI response
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiPlaceholderMessage.id
            ? { ...msg, text: aiResponseText }
            : msg
        )
      );

    } catch (error) {
      console.error("Error querying chat:", error);
       // Replace placeholder with error message
       setMessages((prev) =>
        prev.map((msg) =>
          msg.id === aiPlaceholderMessage.id
            ? { ...msg, text: "Sorry, I couldn't get a response. Please try again." }
            : msg
        )
      );
    } finally {
      setIsLoading(false); // Hide loading indicator
      scrollToBottom(); // Scroll after updating message
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); // Prevent newline in input
      handleSendMessage();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 w-80 md:w-96 h-[60vh] max-h-[500px] bg-card border border-border rounded-lg shadow-xl z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/40">
        <h3 className="font-semibold text-sm">Ask AI about this Meeting</h3>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
          <X className="h-4 w-4" />
          <span className="sr-only">Close chat</span>
        </Button>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex items-start gap-3 text-sm",
                message.sender === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.sender === "ai" && (
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Bot className="h-4 w-4" />
                </span>
              )}
              <div
                className={cn(
                  "p-2 rounded-lg max-w-[80%]",
                  message.sender === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {/* Basic text display, can add Markdown support later */}
                {message.text === "..." ? <Loader2 className="h-4 w-4 animate-spin" /> : message.text}
              </div>
              {message.sender === "user" && (
                 <span className="flex-shrink-0 w-6 h-6 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center">
                  <User className="h-4 w-4" />
                </span>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-3 border-t bg-muted/40">
        <div className="flex items-center gap-2">
          <Input
            type="text"
            placeholder="Ask a question..."
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" onClick={handleSendMessage} disabled={isLoading || !inputValue.trim()}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="sr-only">Send message</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
