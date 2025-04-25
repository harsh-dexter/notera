import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { api, Meeting, TranscriptSegment } from "@/services/api";

export function useMeetingDetails() {
  const { id } = useParams<{ id: string }>();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTranscriptLoading, setIsTranscriptLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTranscript = useCallback(async (meetingId: string) => {
    try {
      setIsTranscriptLoading(true);
      const transcriptData = await api.getTranscript(meetingId);
      setTranscript(transcriptData);
    } catch (err) {
      console.error("Failed to load transcript:", err);
      // Optionally set a specific transcript error state if needed
    } finally {
      setIsTranscriptLoading(false);
    }
  }, []); // No dependencies needed if api.getTranscript is stable

  const fetchMeetingDetails = useCallback(async (meetingId: string) => {
    try {
      setIsLoading(true);
      setError(null); // Clear previous errors
      const meetingData = await api.getMeeting(meetingId);
      setMeeting(meetingData);

      // Fetch transcript if ASR is done (status is analysis or completed)
      if (meetingData.status === "processing_analysis" || meetingData.status === "completed") {
        // Don't necessarily await here, let it load in background
        fetchTranscript(meetingId); 
      }
    } catch (err) {
      setError(`Failed to load meeting details: ${(err as Error).message}`);
      console.error(err);
      setMeeting(null); // Clear meeting data on error
    } finally {
      setIsLoading(false);
    }
  }, [fetchTranscript]); // Include fetchTranscript in dependencies

  useEffect(() => {
    if (!id) {
      setError("Meeting ID is missing.");
      setIsLoading(false);
      return;
    }

    fetchMeetingDetails(id);

    // Polling logic removed. Transcript fetching is handled in fetchMeetingDetails
    // and potentially triggered by status changes observed via props if implemented.

    // No cleanup needed for polling anymore
    // No cleanup needed for polling anymore
    // No cleanup needed for polling anymore
    // return () => {}; // We'll add WS cleanup later

  }, [id, fetchMeetingDetails]); // Initial fetch effect


  // Effect for WebSocket connection for this specific meeting
  useEffect(() => {
    if (!id) return; // Don't connect if ID is missing

    // Determine WebSocket URL
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = "localhost"; // Explicitly set hostname for Electron compatibility
    const wsUrl = `${proto}//${host}:7000/meetings/ws`; // Corrected port to 7000

    console.log(`[Details] Attempting to connect WebSocket to: ${wsUrl} for ID: ${id}`);
    const ws = new WebSocket(wsUrl);
    let wsInstance: WebSocket | null = ws; // Local ref to manage instance

    ws.onopen = () => {
      console.log(`[Details] WebSocket connection established for ID: ${id}`);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log("[Details] WebSocket message received:", message);

        // Only process updates relevant to this meeting ID
        const payload = message.payload; // Keep payload reference
        if ((message.type === "meeting_updated" || message.type === "meeting_created") && payload.id === id) {
           console.log(`[Details] Received relevant update for ID: ${id}`);
           // Map backend payload (upload_time) to frontend Meeting interface (uploadDate)
           const updatedMeetingData: Meeting = {
               id: payload.id,
               filename: payload.filename,
               uploadDate: payload.upload_time, // Map the field name
               status: payload.status,
               languages: payload.languages || [],
               summary: payload.summary || undefined,
               actionItems: Array.isArray(payload.action_items) ? payload.action_items.map((desc: any, index: number) => ({ id: `${payload.id}-action-${index}`, description: desc })) : [],
               decisions: Array.isArray(payload.decisions) ? payload.decisions.map((desc: any, index: number) => ({ id: `${payload.id}-decision-${index}`, description: desc })) : [],
               error: payload.status === "failed" ? (payload.summary || "Processing failed") : undefined,
               // duration might not be in the payload, handle optional fields
               duration: payload.duration || undefined,
           };
           setMeeting(updatedMeetingData); // Update state with correctly mapped data
        } else if (message.type === "meeting_deleted" && payload.id === id) {
           // Handle case where the meeting gets deleted while viewing
           console.log(`[Details] Meeting ${id} was deleted.`);
           setError("This meeting has been deleted.");
           setMeeting(null); // Clear meeting data
           // Optionally navigate away: navigate('/meetings');
        }
      } catch (error) {
        console.error("[Details] Failed to parse WebSocket message or update state:", error);
      }
    };

    ws.onerror = (error) => {
      console.error(`[Details] WebSocket error for ID ${id}:`, error);
      setError("Real-time connection error for meeting details.");
    };

    ws.onclose = (event) => {
      console.log(`[Details] WebSocket connection closed for ID ${id}:`, event.code, event.reason);
      wsInstance = null; // Clear instance ref on close
      // Optionally implement reconnection logic here
    };

    // Cleanup function to close WebSocket on unmount or ID change
    return () => {
      if (wsInstance) {
        console.log(`[Details] Closing WebSocket connection for ID: ${id}`);
        wsInstance.close();
      }
    };
  }, [id]); // Reconnect if ID changes


  // Effect to fetch transcript when meeting status allows it and transcript isn't loaded
  useEffect(() => {
    if (meeting && (meeting.status === "processing_analysis" || meeting.status === "completed") && transcript.length === 0) {
      // Check if transcript array is empty before fetching
      console.log(`Meeting status is ${meeting.status} and transcript is empty, fetching transcript...`);
      fetchTranscript(meeting.id);
    }
    // We only want this effect to run when the meeting object itself changes,
    // specifically when its status might have updated.
  }, [meeting, transcript.length, fetchTranscript]); // Depend on meeting object, transcript length, and fetchTranscript

  return {
    id,
    meeting,
    transcript,
    isLoading,
    isTranscriptLoading,
    error,
    refetchMeetingDetails: () => id ? fetchMeetingDetails(id) : Promise.resolve(), // Provide a way to manually refetch
    // Function to update the title in the local state
    updateMeetingTitleLocally: (newTitle: string) => {
      setMeeting(prevMeeting => {
        if (!prevMeeting) return null;
        return { ...prevMeeting, filename: newTitle };
      });
    },
  };
}
