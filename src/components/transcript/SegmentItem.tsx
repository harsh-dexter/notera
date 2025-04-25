import { TranscriptSegment, SearchResult } from "@/services/api";
import { cn } from "@/lib/utils";

interface SegmentItemProps { // Renamed interface
  segment: TranscriptSegment;
  // Pass only the relevant search result for this specific segment, if any
  searchResult?: SearchResult | null;
}

// Removed formatTime function as it's no longer used

// Check if a segment is in search results and return highlighted JSX
function getHighlightedText(segmentText: string, searchResult?: SearchResult | null): string | JSX.Element[] {
    if (!searchResult || searchResult.matchPositions.length === 0) {
        return segmentText;
    }

    // Sort positions to ensure we build the text correctly
    const positions = [...searchResult.matchPositions].sort((a, b) => a[0] - b[0]);

    let highlightedElements: JSX.Element[] = [];
    let lastIndex = 0;

    positions.forEach(([start, end], i) => {
        // Add text before the highlight
        if (start > lastIndex) {
        highlightedElements.push(
            <span key={`text-${i}`}>{segmentText.substring(lastIndex, start)}</span>
        );
        }

        // Add highlighted text - Use primary color with opacity
        highlightedElements.push(
        <span key={`highlight-${i}`} className="bg-primary/20 rounded px-0.5">
            {segmentText.substring(start, end)}
        </span>
        );

        lastIndex = end;
    });

    // Add any remaining text
    if (lastIndex < segmentText.length) {
        highlightedElements.push(
        <span key="text-end">{segmentText.substring(lastIndex)}</span>
        );
    }

    return highlightedElements;
};


export function SegmentItem({ segment, searchResult }: SegmentItemProps) { // Renamed function and props usage
  const highlightedText = getHighlightedText(segment.text, searchResult);

  return (
    <div key={segment.id} className={cn(
      "pl-3 border-l-2 py-0.5", // Adjusted padding slightly as top div is removed
      searchResult ? "border-primary/50" : "border-border" // Highlight border if searchResult exists
    )}>
      {/* Removed the div containing timestamp and language */}
      <p className="text-sm text-foreground leading-relaxed">{highlightedText}</p>
    </div>
  );
}
