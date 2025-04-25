import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SearchBar } from "./SearchBar"; // Updated import path
import { Plus } from "lucide-react";

interface ListHeaderProps { // Renamed interface
  searchQuery: string;
  isSearching: boolean;
  onSearch: (query: string) => Promise<void>;
  onClearSearch: () => void;
}

export function ListHeader({ // Renamed function
  searchQuery,
  isSearching,
  onSearch,
  onClearSearch,
}: ListHeaderProps) { // Updated props usage
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
      <h2 className="text-3xl font-bold tracking-tight text-foreground">Your Meetings</h2>
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <SearchBar
          placeholder="Search titles & transcripts..."
          onSearch={onSearch}
          onClear={onClearSearch}
          isSearching={isSearching}
          initialQuery={searchQuery}
          className="flex-grow" // Allow search bar to take space
        />
        <Button asChild className="shrink-0">
          <Link to="/">
            <Plus className="mr-2 h-4 w-4" /> New
          </Link>
        </Button>
      </div>
    </div>
  );
}
