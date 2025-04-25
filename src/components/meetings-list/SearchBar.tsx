import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2, X } from "lucide-react";

interface SearchBarProps {
  onSearch: (query: string) => Promise<void>;
  onClear?: () => void;
  placeholder?: string;
  initialQuery?: string;
  isSearching?: boolean;
  className?: string;
}

export function SearchBar({
  onSearch,
  onClear,
  placeholder = "Search...", // Updated placeholder
  initialQuery = "",
  isSearching = false,
  className,
}: SearchBarProps) {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const DEBOUNCE_DELAY = 200; // Reduced debounce delay for real-time feel

  // Effect to trigger search when searchQuery changes (with shorter debounce)
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Perform search immediately for empty query
    if (searchQuery === "") {
      onSearch(searchQuery);
      return;
    }
    
    // Very short delay to batch typing events
    debounceTimeoutRef.current = setTimeout(async () => { // Make async to await onSearch
      try {
        // Trigger search and wait for it to potentially finish
        await onSearch(searchQuery);
      } catch (error) {
        // Log error if needed, but focus should still be attempted
        console.error("Search failed within SearchBar effect:", error);
      } finally {
        // Attempt to refocus after search completes or fails
        // Use a minimal timeout to ensure it runs after potential re-renders
        setTimeout(() => {
           if (inputRef.current && document.body.contains(inputRef.current)) {
             inputRef.current.focus();
           }
        }, 0);
      }
    }, DEBOUNCE_DELAY);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [searchQuery, onSearch]);

  // Update local state if initialQuery changes externally
  useEffect(() => {
    setSearchQuery(initialQuery);
  }, [initialQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    // No need to call onSearch here - the effect will handle it
  };

  const handleClear = () => {
    setSearchQuery(""); 
    if (onClear) {
      onClear();
    } else {
      // If no explicit clear handler, call onSearch with empty string
      onSearch("");
    }
  };

  // Handle form submission to trigger immediate search without waiting for debounce
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear any pending debounce
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    // Trigger search immediately and restore focus afterward
    const searchPromise = onSearch(searchQuery);
    if (searchPromise && searchPromise instanceof Promise) {
      searchPromise.finally(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`relative flex-1 ${className}`}>
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="search"
        placeholder={placeholder}
        className="pl-10 pr-9 h-10 hide-default-search-cancel" 
        value={searchQuery}
        onChange={handleInputChange}
        disabled={isSearching}
        // Removed the onBlur handler, focus is now managed in the useEffect
      />
      {searchQuery && !isSearching && (
        <button
          type="button"
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full"
          onClick={handleClear}
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {isSearching && (
         <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
      )}
    </form>
  );
}
