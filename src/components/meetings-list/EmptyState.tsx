import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Wand2 } from "lucide-react";

export function EmptyState() { // Renamed function
  return (
    <div className="text-center py-16 border border-border bg-secondary rounded-2xl">
      <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Wand2 className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-xl font-semibold mb-2 text-foreground">No meetings yet</h3>
      <p className="text-muted-foreground mb-5">
        Upload your first meeting audio to get started.
      </p>
      <Button asChild>
        <Link to="/">Upload Meeting</Link>
      </Button>
    </div>
  );
}
