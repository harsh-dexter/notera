import { TranscriptSegment, SearchResult } from "@/services/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SpeakerGroup } from "./SpeakerGroup"; // Updated import path

import { SearchX } from "lucide-react"; // Added icon for no results

interface TranscriptViewerProps {
  transcript: TranscriptSegment[]; // This will be the potentially filtered list
  searchResults?: SearchResult[];
  isSearching?: boolean;
  showNoResultsMessage?: boolean; // New prop
  searchQuery?: string; // New prop
}

// formatTime and getHighlightedText are moved to TranscriptSegmentItem

export function TranscriptViewer({
  transcript,
  searchResults,
  isSearching,
  showNoResultsMessage,
  searchQuery
}: TranscriptViewerProps) {
  // Group transcript segments by speaker - This logic remains here, works on the filtered list
  const groupedTranscript: { [speakerId: string]: TranscriptSegment[] } = {};
  transcript.forEach((segment) => {
    const speakerId = segment.speakerId || "unknown"; // Handle potential null/undefined speakerId
    if (!groupedTranscript[speakerId]) {
      groupedTranscript[speakerId] = [];
    }
    groupedTranscript[speakerId].push(segment);
  });

  return (
    <div className="border border-border rounded-2xl bg-card text-card-foreground">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-lg">Meeting Transcript</h3>
      </div>

      {/* Apply max-height for scroll */}
      <ScrollArea className="max-h-[500px] p-4"> {/* Removed h-full */}
        {/* Loading state */}
        {isSearching ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            {/* Consider using the Spinner component if available */}
            <div className="animate-spin h-6 w-6 border-2 border-primary rounded-full border-t-transparent"></div>
            <span className="ml-3">Searching transcript...</span>
          </div>
        /* No search results state */
        ) : showNoResultsMessage ? (
           <div className="text-center py-10 text-muted-foreground">
             <SearchX className="mx-auto h-8 w-8 mb-2 opacity-50" />
             <p>No results found for "{searchQuery}"</p>
           </div>
        /* Transcript available state */
        ) : transcript.length > 0 ? (
          <div className="space-y-6">
            {Object.entries(groupedTranscript).map(([speakerId, segments]) => (
              <SpeakerGroup
                key={speakerId}
                speakerId={speakerId}
                segments={segments}
                searchResults={searchResults} // Pass search results down
              />
            ))}
          </div>
        /* No transcript available state (initial load or empty transcript) */
        ) : (
          <div className="text-center py-10 text-muted-foreground">
            <p>No transcript available yet.</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
