import { useState } from "react"; // Keep useState for isExporting
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/page-layout";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChevronLeft, RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import { useMeetingDetails } from "@/hooks/use-meeting-details";
import { DetailsHeader } from "@/components/meeting/DetailsHeader"; // Renamed import
import { SummaryCard } from "@/components/meeting/SummaryCard"; // Renamed import
import { ActionItemsCard } from "@/components/meeting/ActionItemsCard"; // Renamed import
import { TranscriptSection } from "@/components/meeting/TranscriptSection"; // Renamed import
import { ChatTrigger } from "@/components/chat/ChatTrigger";
import { ChatPopup } from "@/components/chat/ChatPopup";
import { api, TranscriptSegment } from "@/services/api"; // Import TranscriptSegment
import { useRecording } from "@/context/RecordingContext";
import { useEffect } from "react"; // Import useEffect

export default function MeetingDetails() {
  const navigate = useNavigate();
  const { // Meeting details hook
    id,
    meeting,
    transcript,
    isLoading,
    isTranscriptLoading,
    error,
    refetchMeetingDetails,
    updateMeetingTitleLocally,
  } = useMeetingDetails();
  const { // Recording context hook
    isLiveRecording,
    liveMeetingId,
    stopLiveRecording
  } = useRecording();
  // Use local state for transcript segments to allow live updates
  const [liveTranscript, setLiveTranscript] = useState<TranscriptSegment[]>([]);

  const [isExporting, setIsExporting] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Check if the current meeting is the one being actively recorded
  const isCurrentlyRecordingThisMeeting = isLiveRecording && liveMeetingId === id;

  // --- WebSocket Effect ---
  useEffect(() => {
    // Only connect if this is the meeting being recorded OR if it's a live recording status from backend
    // (We might need to adjust the condition if backend sends initial 'recording_live' status via REST)
    if (!id || (!isCurrentlyRecordingThisMeeting && meeting?.status !== 'recording_live')) {
      return; // Don't connect if not relevant
    }

    console.log(`MeetingDetails: Setting up WebSocket connection for meeting ${id}...`);
    // TODO: Get WebSocket URL from config/env
    const wsUrl = "ws://localhost:7000/meetings/ws"; // Matches backend router
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log(`MeetingDetails: WebSocket connected for meeting ${id}`);
      // Optionally send a message to subscribe to this specific meeting ID if backend requires it
      // ws.send(JSON.stringify({ type: "subscribe", meetingId: id }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log("MeetingDetails: WebSocket message received:", message);

        // Handle transcript updates specifically for this meeting
        if (message.type === "transcript_update" && message.payload?.meetingId === id) {
          const newSegment = message.payload.segment as TranscriptSegment;
          console.log("MeetingDetails: Received transcript segment:", newSegment);
          setLiveTranscript((prevTranscript) => {
            // Avoid adding duplicate segments if backend sends multiple times
            if (prevTranscript.some(seg => seg.id === newSegment.id)) {
              return prevTranscript;
            }
            // Add the new segment and sort by start time
            return [...prevTranscript, newSegment].sort((a, b) => a.startTime - b.startTime);
          });
        }
        // TODO: Handle other message types if needed (e.g., status updates)

      } catch (error) {
        console.error("MeetingDetails: Error parsing WebSocket message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error(`MeetingDetails: WebSocket error for meeting ${id}:`, error);
    };

    ws.onclose = (event) => {
      console.log(`MeetingDetails: WebSocket disconnected for meeting ${id}. Code: ${event.code}, Reason: ${event.reason}`);
      // Optionally implement reconnection logic here
    };

    // Cleanup function to close WebSocket connection when component unmounts or ID changes
    return () => {
      console.log(`MeetingDetails: Closing WebSocket connection for meeting ${id}`);
      ws.close();
    };

  }, [id, isCurrentlyRecordingThisMeeting, meeting?.status]); // Reconnect if meeting ID or recording status changes

  // --- End WebSocket Effect ---


  // Removed handleSearch as search is now local to TranscriptSection

  const handleExport = async () => {
    if (!id) return;

    try {
      setIsExporting(true);
      const pdfBlob = await api.exportMeetingReport(id);

      // Create a download link
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meeting-summary-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      // TODO: Show an error toast to the user
    } finally {
      setIsExporting(false);
    }
  };


  if (isLoading) {
    return (
      <PageLayout> {/* Wrap loading in PageLayout */}
        <div className="container flex items-center justify-center py-20">
          <Spinner size="lg" text="Loading meeting details..." />
        </div>
      </PageLayout>
    );
  }


  if (error) {
    return (
      <PageLayout>
        <div className="container flex items-center justify-center py-20">
          <Alert variant="destructive" className="max-w-md w-full text-center">
            <AlertTitle className="text-lg font-semibold mb-2">Error Loading Meeting</AlertTitle>
            <AlertDescription>
              <p className="mb-4">{error}</p>
              <div className="flex space-x-3 justify-center">
                <Button variant="outline" onClick={() => navigate("/meetings")}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Back to Meetings
                </Button>
                <Button onClick={refetchMeetingDetails}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </PageLayout>
    );
  }


  if (!meeting) {
    // This state might be briefly visible if the initial fetch is fast but finds nothing,
    // or after an error state where meeting is set to null by the hook.
    // Consider if a more specific "Not Found" message is needed or if the error state covers it.
    return (
      <PageLayout>
        <div className="container flex items-center justify-center py-20">
          <Alert className="max-w-md w-full text-center bg-secondary border-border">
            <AlertTitle className="text-lg font-semibold mb-2">Meeting Not Found</AlertTitle>
            <AlertDescription>
              <p className="text-muted-foreground mb-4">
                The meeting you're looking for doesn't exist or may have been deleted.
              </p>
              <Button asChild>
                <Link to="/meetings">
                  <span className="flex items-center">
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back to Meetings
                  </span>
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </PageLayout>
    );
  }


  return (
    <PageLayout>
      <div className="container px-4 py-6 sm:px-6 lg:px-8">
        {/* Header Section */}
        <DetailsHeader
          meeting={meeting}
          isExporting={isExporting}
          onExport={handleExport}
          onTitleUpdate={updateMeetingTitleLocally}
          summary={meeting.summary}
          actionItems={meeting.actionItems}
          // Pass recording state and stop function to header
          isRecording={isCurrentlyRecordingThisMeeting}
          onStopRecording={stopLiveRecording}
        />

        {/* Body Section - Render based on specific status */}
        {(() => {
          switch (meeting.status) {
            case "processing_asr":
              return (
                <div className="bg-secondary border border-border rounded-2xl p-8 text-center">
                  <div className="mx-auto w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                    <Loader2 className="h-6 w-6 text-blue-800 animate-spin" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Transcribing Audio</h3>
                  <p className="text-muted-foreground mb-4">
                    Extracting text from your audio file. This may take a few minutes.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    You can leave this page; processing will continue.
                  </p>
                </div>
              );
            // Removed redundant 'processing_analysis' case here.
            // It's handled by the fallthrough from 'recording_live' below.
            case "failed":
              return (
                <Alert variant="destructive" className="text-center p-6">
                  <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
                    <AlertCircle className="h-6 w-6 text-destructive" />
                  </div>
                  <AlertTitle className="text-lg font-semibold mb-1">Processing Failed</AlertTitle>
                  <AlertDescription>
                    <p className="mb-4">
                      {meeting.error || "We encountered an error while processing your meeting audio."}
                    </p>
                    <Button asChild>
                      <Link to="/">
                        <span>Try Uploading Again</span>
                      </Link>
                    </Button>
                  </AlertDescription>
                </Alert>
              );
            // Make 'recording_live' fall through to 'processing_analysis'
            case "recording_live":
            // Intentionally fall through
            case "processing_analysis": // Correctly handle fallthrough, remove duplicate comment
              return (
                // Show transcript while analysis is happening (or recording is live)
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Show placeholders/loading for summary/actions */}
                  <div className="lg:col-span-1 space-y-6">
                     <SummaryCard summary={undefined} isLoading={true} />
                     <ActionItemsCard actionItems={undefined} isLoading={true} />
                  </div>
                  {/* Right Column: Explicitly wrap TranscriptSection */}
                  <div className="lg:col-span-2">
                    <TranscriptSection
                      transcript={liveTranscript.length > 0 ? liveTranscript : transcript} // Prioritize live transcript
                      isLoading={isTranscriptLoading && liveTranscript.length === 0} // Only show loading if no live data yet
                    />
                  </div>
                </div>
              );
            case "completed":
              return (
                // Completed State Layout (no changes needed here for now)
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Summary & Action Items */}
                  <div className="lg:col-span-1 space-y-6">
                    <SummaryCard summary={meeting.summary} />
                    <ActionItemsCard actionItems={meeting.actionItems} />
                  </div>
                  {/* Right Column: Explicitly wrap TranscriptSection and add overflow-hidden */}
                  <div className="lg:col-span-2 overflow-hidden">
                    <TranscriptSection
                      transcript={liveTranscript.length > 0 ? liveTranscript : transcript} // Show live if populated, else fetched
                      isLoading={isTranscriptLoading && liveTranscript.length === 0}
                    />
                  </div>
                </div>
              );
            default:
              // Should not happen with proper typing, but handle defensively
              return <div>Unknown meeting status: {meeting.status}</div>; 
          }
        })()}

        {/* Chat Trigger Button - Only show when completed and chat is not open */}
        {meeting.status === "completed" && !isChatOpen && (
          <ChatTrigger onClick={() => setIsChatOpen(true)} />
        )}

        {/* Chat Popup - Render when isChatOpen is true */}
        {isChatOpen && id && ( // Ensure id is available before rendering popup
          <ChatPopup
            meetingId={id}
            onClose={() => setIsChatOpen(false)}
          />
        )}
      </div>
    </PageLayout>
  );
}
