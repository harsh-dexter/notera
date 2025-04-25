
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Spinner } from "@/components/ui/spinner";
import { CalendarDays, Clock, FileAudio } from "lucide-react"; // Removed Trash2
import { Meeting } from "@/services/api"; // Removed api import (not needed anymore)
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
// Removed Button, AlertDialog components, React, useState, useToast imports

interface MeetingCardProps {
  meeting: Meeting;
  // Removed onDelete prop
}

export function MeetingCard({ meeting }: MeetingCardProps) { // Removed onDelete from props
  // Removed isAlertOpen, isDeleting, toast state/hooks

  // Calculate date/time only if uploadDate is valid
  const formattedDate = meeting.uploadDate ? new Date(meeting.uploadDate).toLocaleDateString() : null;
  const timeAgo = meeting.uploadDate ? formatDistanceToNow(new Date(meeting.uploadDate), { addSuffix: true }) : null;
  // Check for either processing state
  const isProcessing = meeting.status === 'processing_asr' || meeting.status === 'processing_analysis';

  // Removed handleDeleteClick and handleConfirmDelete handlers
  return (
    // Wrap the entire card with Link
    <Link to={`/meetings/${meeting.id}`} className={`block relative transition-shadow duration-200 hover:shadow-lg dark:hover:shadow-lg dark:hover:shadow-primary/10 rounded-2xl border ${isProcessing ? 'opacity-75 pointer-events-none' : ''}`}> {/* Use distinct shadows for light/dark hover, disable pointer events when processing */}
      <Card className="h-full flex flex-col rounded-2xl border-none shadow-none bg-card"> {/* Remove card's own border/shadow, ensure background */}
        <CardHeader className="p-4 pb-2"> {/* Increased padding */}
          <div className="flex justify-between items-start gap-2"> {/* Added gap */}
             {/* Title is no longer wrapped in Link */}
            <div className="flex-grow min-w-0 mr-2"> {/* Removed focus styles */}
              <CardTitle className="text-lg font-semibold line-clamp-2 text-left"> {/* Increased font weight, allow 2 lines, removed hover:underline */}
                {meeting.filename}
              </CardTitle>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0"> {/* Reduced gap slightly */}
               {isProcessing && <Spinner size="sm" />} {/* Conditionally render spinner - corrected size */}
               <StatusBadge status={meeting.status} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 pb-2 flex-grow"> {/* Increased padding, Added flex-grow */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-muted-foreground"> {/* Increased gap */}
            {/* Conditionally render date/time */}
            {timeAgo && formattedDate ? (
              <div className="flex items-center">
                <CalendarDays className="h-4 w-4 mr-1.5 opacity-70 flex-shrink-0" /> {/* Adjusted margin */}
                <span className="truncate" title={formattedDate}>{timeAgo}</span> {/* Added truncate */}
              </div>
            ) : (
              <div className="flex items-center"> {/* Placeholder or empty div if no date */}
                 <CalendarDays className="h-4 w-4 mr-1.5 opacity-70 flex-shrink-0" />
                 <span>-</span> {/* Or simply leave empty */}
              </div>
            )}
            {meeting.duration && (
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-1.5 opacity-70 flex-shrink-0" /> {/* Adjusted margin */}
                <span className="truncate">{meeting.duration}</span> {/* Added truncate */}
              </div>
            )}
            {/* Add Array.isArray check for robustness */}
            {Array.isArray(meeting.languages) && meeting.languages.length > 0 && (
              <div className="flex items-center col-span-2"> {/* Span 2 columns if duration is present */}
                <FileAudio className="h-4 w-4 mr-1.5 opacity-70 flex-shrink-0" /> {/* Adjusted margin */}
                <span className="truncate" title={meeting.languages.join(', ')}> {/* Add title for full list */}
                  {meeting.languages.map(lang => lang.toUpperCase()).join(', ')}
                </span> {/* Display joined languages */}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="p-4 pt-2 flex justify-between items-end"> {/* Increased padding, flex justify-between */}
          <div className="flex-grow mr-2 min-w-0"> {/* Allow text to take space, prevent overflow */}
            {meeting.status === "completed" && meeting.summary && (
              <p className="text-xs text-muted-foreground line-clamp-2 text-left"> {/* Allow 2 lines */}
                {meeting.summary}
              </p>
            )}
            {/* Show specific message based on processing stage */}
            {meeting.status === "processing_asr" && (
               <p className="text-xs text-muted-foreground italic">Processing transcript...</p>
            )}
            {meeting.status === "processing_analysis" && (
               <p className="text-xs text-muted-foreground italic">Processing summary...</p>
            )}
            {meeting.status === "failed" && (
              <p className="text-xs text-destructive"> {/* Use theme color */}
                {meeting.error || "Processing failed"} {/* Updated default message */}
              </p>
            )}
          </div>
          {/* Removed Delete Button and Dialog */}
        </CardFooter>
      </Card>
    </Link> // Close the Link wrapper
  );
}
