import { Button } from "@/components/ui/button";
import { MessageSquarePlus } from "lucide-react"; // Or another suitable icon

interface ChatTriggerProps {
  onClick: () => void; // Function to call when the button is clicked
}

export function ChatTrigger({ onClick }: ChatTriggerProps) {
  return (
    <Button
      onClick={onClick}
      variant="default" // Or choose another variant like 'secondary' or 'outline'
      size="icon"
      className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50" // Styling for FAB
      aria-label="Open chat"
    >
      <MessageSquarePlus className="h-6 w-6" />
    </Button>
  );
}
