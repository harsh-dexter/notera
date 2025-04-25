import { SearchX } from "lucide-react";

interface SearchEmptyStateProps { // Renamed interface
  searchQuery: string;
}

export function SearchEmptyState({ searchQuery }: SearchEmptyStateProps) { // Renamed function and props usage
  return (
    <div className="text-center py-16 border border-border bg-secondary rounded-2xl">
      <div className="mx-auto w-12 h-12 rounded-full bg-accent flex items-center justify-center mb-4">
        <SearchX className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold mb-2 text-foreground">No Matching Meetings</h3>
      <p className="text-muted-foreground">
        Your search for "{searchQuery}" did not return any results.
      </p>
      {/* Optionally add a button to clear search here if needed */}
    </div>
  );
}
