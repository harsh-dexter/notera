import { useState, useCallback } from "react"; // Added useState, useCallback
import { SearchBar } from "@/components/meetings-list/SearchBar";
import { TranscriptViewer } from "@/components/transcript/TranscriptViewer";
import { Spinner } from "@/components/ui/spinner";
import { TranscriptSegment, SearchResult } from "@/services/api"; // Added SearchResult
import { formatTime } from "@/lib/utils"; // Import formatTime

interface TranscriptSectionProps {
  transcript: TranscriptSegment[];
  isLoading: boolean;
  // Removed onSearch prop
}

export function TranscriptSection({ transcript, isLoading }: TranscriptSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false); // Local searching state

  // Function to perform local search (made async to match SearchBar prop type)
  const handleLocalSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    setIsSearching(true); // Indicate searching starts

    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const lowerCaseQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    transcript.forEach(segment => {
      const text = segment.text.toLowerCase();
      let matchPositions: [number, number][] = [];
      let startIndex = 0;
      let index = text.indexOf(lowerCaseQuery, startIndex);

      while (index !== -1) {
        const endIndex = index + lowerCaseQuery.length;
        matchPositions.push([index, endIndex]);
        startIndex = index + 1; // Move past the current match start
        index = text.indexOf(lowerCaseQuery, startIndex);
      }

      if (matchPositions.length > 0) {
        results.push({
          segmentId: segment.id,
          text: segment.text, // Keep original case text if needed by viewer
          matchPositions: matchPositions,
        });
      }
    });

    setSearchResults(results);
    setIsSearching(false); // Indicate searching finished
  }, [transcript]); // Dependency: transcript

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    setSearchResults([]);
    setIsSearching(false);
  }, []);

  // Determine which transcript segments to display
  const displayedTranscript = searchQuery.trim() && searchResults.length > 0
    ? transcript.filter(segment => searchResults.some(result => result.segmentId === segment.id))
    : transcript; // Show all if no search or no results from search

  // Determine if the search yielded no results
  const noSearchResults = searchQuery.trim() && !isSearching && searchResults.length === 0;

  return (
    <div className="lg:col-span-2 space-y-4">
      {/* Search Bar - Use local handlers */}
      <SearchBar
        onSearch={handleLocalSearch}
        onClear={handleClearSearch}
        initialQuery={searchQuery}
        isSearching={isSearching} // Pass local searching state
        placeholder="Search transcript..."
      />

      {/* Transcript Viewer */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64 border border-border rounded-2xl bg-card">
          <Spinner text="Loading transcript..." />
        </div>
      ) : (
        <TranscriptViewer
          transcript={displayedTranscript} // Pass the potentially filtered list
          searchResults={searchResults}
          isSearching={isSearching}
          showNoResultsMessage={noSearchResults} // Pass flag to show "no results"
          searchQuery={searchQuery} // Pass query for the "no results" message
        />
      )}
      {/* Removed redundant rendering blocks below. TranscriptViewer handles display. */}
    </div>
  );
}
