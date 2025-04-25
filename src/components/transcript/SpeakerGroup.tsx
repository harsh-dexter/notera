import { TranscriptSegment, SearchResult } from "@/services/api";
import { SegmentItem } from "./SegmentItem"; // Renamed import

interface SpeakerGroupProps {
  speakerId: string;
  segments: TranscriptSegment[];
  searchResults?: SearchResult[]; // Pass all search results down
}

export function SpeakerGroup({ speakerId, segments, searchResults }: SpeakerGroupProps) {
  if (!segments || segments.length === 0) {
    return null;
  }

  const speakerName = segments[0].speakerName || `Speaker ${speakerId}`;
  const speakerInitial = speakerName?.[0]?.toUpperCase() || "?";

  // Helper to find the specific search result for a segment
  const findSearchResult = (segmentId: string): SearchResult | undefined => {
    return searchResults?.find(r => r.segmentId === segmentId);
  };

  return (
    <div key={speakerId} className="space-y-3">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
          {speakerInitial}
        </div>
        <span className="font-semibold text-foreground">{speakerName}</span>
      </div>

      <div className="pl-11 space-y-3">
        {segments.map((segment) => (
          <SegmentItem // Renamed component usage
            key={segment.id}
            segment={segment}
            searchResult={findSearchResult(segment.id)} // Pass only the relevant result
          />
        ))}
      </div>
    </div>
  );
}
