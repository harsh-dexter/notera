import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton
import ReactMarkdown from 'react-markdown'; // Import ReactMarkdown

interface SummaryCardProps {
  summary: string | null | undefined;
  isLoading?: boolean; // Add isLoading prop
}

export function SummaryCard({ summary, isLoading }: SummaryCardProps) { 
  return (
    <div className="border border-border rounded-2xl bg-card text-card-foreground">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-lg">Meeting Summary</h3>
      </div>
      <div className="p-4">
        {isLoading ? (
          // Show skeleton loaders when loading
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : (
          // Show actual summary or placeholder when not loading
          <div className="text-sm text-foreground leading-relaxed"> {/* Apply styling to wrapper */}
            {summary ? (
              <ReactMarkdown>{summary}</ReactMarkdown>
            ) : (
              <span className="text-muted-foreground italic">No summary available.</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
