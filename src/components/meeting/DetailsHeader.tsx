import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom"; // Added useNavigate
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Meeting, api, ActionItem } from "@/services/api";
import { ChevronLeft, Download, Calendar, Clock, Loader2, Pencil, Check, X, Clipboard, Share2, Trash2 } from "lucide-react"; // Added Trash2
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"; // Import AlertDialog components

interface MeetingDetailsHeaderProps {
  meeting: Meeting;
  isExporting: boolean;
  onExport: () => void;
  onTitleUpdate: (newTitle: string) => void;
  summary?: string | null;
  actionItems?: ActionItem[] | null;
  // Add props for live recording control
  isRecording?: boolean;
  onStopRecording?: () => void;
}

export function DetailsHeader({
  meeting,
  isExporting,
  onExport,
  onTitleUpdate,
  summary,
  actionItems,
  isRecording,      // Destructure new props
  onStopRecording   // Destructure new props
}: MeetingDetailsHeaderProps) {
  const { toast } = useToast();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [currentTitle, setCurrentTitle] = useState(meeting.filename);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false); // State for delete dialog
  const [isDeleting, setIsDeleting] = useState(false); // State for deleting status
  const navigate = useNavigate(); // Hook for navigation

  // Check if meeting is processing
  const isProcessing = meeting.status === 'processing_asr' || meeting.status === 'processing_analysis';

  // Reset copied state after a delay
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000); // Hide after 2 seconds
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const uploadDateTime = new Date(meeting.uploadDate);
  const formattedDate = uploadDateTime.toLocaleDateString();
  const formattedTime = uploadDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); // Format time

  const handleEditClick = () => {
    setCurrentTitle(meeting.filename); // Reset to original on edit start
    setIsEditingTitle(true);
  };

  const handleCancelClick = () => {
    setIsEditingTitle(false);
    // No need to reset currentTitle here, it's reset on next edit click
  };

  const handleSaveClick = async () => {
    if (!currentTitle.trim() || currentTitle.trim() === meeting.filename) {
      setIsEditingTitle(false); // Exit edit mode if title is empty or unchanged
      return;
    }
    setIsSavingTitle(true);
    try {
      await api.updateMeetingTitle(meeting.id, currentTitle.trim());
      onTitleUpdate(currentTitle.trim()); // Notify parent about the update
      setIsEditingTitle(false);
      toast({
        title: "Success",
        description: "Meeting title updated.",
      });
    } catch (error) {
      console.error("Failed to update title:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to update title: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSaveClick();
    } else if (event.key === 'Escape') {
      handleCancelClick();
    }
  };


  // --- Delete Handlers ---
  const handleDeleteClick = () => {
    setIsAlertOpen(true); // Open confirmation dialog
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await api.deleteMeeting(meeting.id);
      toast({
        title: "Meeting Deleted",
        description: `"${meeting.filename}" has been deleted.`,
      });
      // No need to close dialog here, it closes automatically on action/cancel
      navigate("/meetings"); // Navigate back to the list after deletion
    } catch (error) {
      console.error("Failed to delete meeting:", error);
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: error instanceof Error ? error.message : "Could not delete the meeting.",
      });
      setIsAlertOpen(false); // Close dialog on error
    } finally {
      setIsDeleting(false);
    }
  };
  // ----------------------


  const getShareableContent = () => {
    let content = `Meeting: ${meeting.filename}\nDate: ${formattedDate}\n\n`;
    if (summary) {
      content += `Summary:\n${summary}\n\n`;
    }
    if (actionItems && actionItems.length > 0) {
      content += `Action Items:\n${actionItems.map(item => `- ${item.description}`).join('\n')}`;
    }
    return content.trim();
  };


  const handleCopy = async () => {
    const contentToCopy = getShareableContent();
    if (!contentToCopy) {
      toast({ variant: "destructive", title: "Nothing to copy" });
      return;
    }
    try {
      await navigator.clipboard.writeText(contentToCopy);
      setCopied(true); // Show feedback
      toast({ title: "Copied to clipboard!" });
    } catch (err) {
      console.error("Failed to copy:", err);
      toast({ variant: "destructive", title: "Copy failed", description: "Could not copy content to clipboard." });
    }
  };


  // Function to initiate sharing via Electron IPC
  const handleElectronShare = () => {
    const contentToShare = getShareableContent();
    if (!contentToShare) {
      toast({ variant: "destructive", title: "Nothing to share" });
      return;
    }
    // Check if the electronAPI is available (it should be in Electron)
    if (window.electronAPI?.shareContent) {
      window.electronAPI.shareContent(contentToShare);
      // Optional: Add a toast to indicate the action was sent
      // toast({ title: "Preparing share..." });
      console.log("Sent share request to main process via IPC.");
    } else {
      // Fallback if somehow running outside Electron or preload failed
      console.warn("Electron share API not found. Falling back to copy.");
      handleCopy();
      toast({ title: "Share via OS not available", description: "Content copied to clipboard instead." });
    }
  };


  return (
    <div className="mb-6">
      <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 text-muted-foreground hover:text-foreground">
        <Link to="/meetings">
          <span className="flex items-center">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to Meetings
          </span>
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-grow min-w-0"> {/* Allow title section to grow and wrap */}
          <div className="flex items-center gap-2 mb-1">
            {isEditingTitle ? (
              <div className="flex items-center gap-2 flex-grow">
                <Input
                  value={currentTitle}
                  onChange={(e) => setCurrentTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="text-3xl font-bold tracking-tight h-auto p-0 border-0 shadow-none focus-visible:ring-0" // Basic styling to match h2
                  disabled={isSavingTitle}
                  autoFocus
                />
                <Button variant="ghost" size="icon" onClick={handleSaveClick} disabled={isSavingTitle || !currentTitle.trim()}>
                  {isSavingTitle ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5 text-green-600" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={handleCancelClick} disabled={isSavingTitle}>
                  <X className="h-5 w-5 text-red-600" />
                </Button>
              </div>
            ) : (
              <>
                <h2 className="text-3xl font-bold tracking-tight text-foreground truncate mr-2" title={meeting.filename}>
                  {meeting.filename}
                </h2>
                <Button variant="ghost" size="icon" onClick={handleEditClick} className="text-muted-foreground hover:text-foreground" disabled={isProcessing}>
                  <Pencil className="h-5 w-5" />
                </Button>
                {/* Delete Button and Dialog Trigger */}
                <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={handleDeleteClick}
                      aria-label="Delete meeting"
                      disabled={isProcessing} // Disable delete if processing
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the meeting
                        "{meeting.filename}" and all associated data.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleConfirmDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                        {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</> : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <StatusBadge status={meeting.status} />

            <div className="flex items-center">
              <Calendar className="mr-1.5 h-4 w-4" />
              <span title={formattedDate}>{formattedDate} {formattedTime}</span> {/* Display date and time */}
            </div>

            {meeting.duration && (
              <div className="flex items-center">
                <Clock className="mr-1.5 h-4 w-4" />
                <span>{meeting.duration}</span>
              </div>
            )}

            {/* Display multiple language badges - Add Array.isArray check */}
            {Array.isArray(meeting.languages) && meeting.languages.length > 0 && (
              meeting.languages.map((lang) => (
                <span
                  key={lang} // Add key for list rendering
                  className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground"
                  title={lang} // Add title attribute for full code on hover
                >
                  {lang.toUpperCase()} {/* Display uppercase ISO code */}
                </span>
              ))
            )}
          </div>
        </div> {/* Correctly close the flex-grow div here */}

        {/* Action Buttons Container - Always render the container div */}
        <div className="flex flex-wrap gap-2 shrink-0"> {/* Wrap buttons */}

          {/* Stop Recording Button - Show only if currently recording this meeting */}
          {isRecording && onStopRecording && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onStopRecording}
            >
              {/* Consider adding an icon like Square */}
              Stop Recording
            </Button>
          )}

          {/* Other Action Buttons - Show only when completed AND not currently recording */}
          {meeting.status === "completed" && !isRecording && (
            <> {/* Fragment to group these buttons */}
              {/* Copy Button */}
              <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={copied} // Disable briefly after copy
            >
              <Clipboard className="mr-2 h-4 w-4" />
              {copied ? "Copied!" : "Copy Summary"}
            </Button>

            {/* Share/Copy Button - Always visible, uses copy as fallback */}
            <Button
              variant="outline"
              size="sm"
              // Use the new Electron share handler
              onClick={handleElectronShare}
            >
              <Share2 className="mr-2 h-4 w-4" />
              {/* Always display "Share", fallback logic is in onClick */}
              Share
            </Button>

            {/* Export PDF Button */}
            <Button
              onClick={onExport}
              disabled={isExporting}
              size="sm" // Match size
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" /> Export PDF
                </>
              )}
            </Button>
            {/* Duplicated Stop Recording button removed from here */}
            </> // Close the fragment for completed state buttons
          )}
        </div> {/* Close the main action buttons container div */}
      </div> {/* Close the outer flex container */}
    </div>
  );
}
