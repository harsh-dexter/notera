import { useState, useEffect, useCallback, useRef } from "react"; // Import useRef
import { api, Meeting } from "@/services/api";

export function useMeetingsList() {
  const [allMeetings, setAllMeetings] = useState<Meeting[]>([]); // Store the full list
  const [displayedMeetings, setDisplayedMeetings] = useState<Meeting[]>([]); // Meetings currently shown
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(""); // Keep track of the current search query
  const wsRef = useRef<WebSocket | null>(null); // Ref to hold WebSocket instance

  // Helper function to sort meetings
  const sortMeetings = (meetings: Meeting[]) => {
    return meetings.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
  };

  // Effect to update displayed meetings when allMeetings or searchQuery changes
  useEffect(() => {
    if (!searchQuery) {
      setDisplayedMeetings(allMeetings);
    } else {
      // Re-apply local filter if search query exists
      const trimmedQuery = searchQuery.trim().toLowerCase();
      const localResults = allMeetings.filter(meeting =>
        meeting.filename.toLowerCase().includes(trimmedQuery) ||
        meeting.summary?.toLowerCase().includes(trimmedQuery)
      );
      setDisplayedMeetings(localResults);
      // Note: We are not re-triggering the API search here on every update,
      // relying on WebSocket for updates. API search happens in handleSearch.
    }
  }, [allMeetings, searchQuery]);


  // Memoized function to fetch initial meetings
  const fetchMeetings = useCallback(async () => {
    // Show loading indicator for initial fetch
    setIsLoading(true);
    try {
      const data = await api.getMeetings();
      data.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
      setAllMeetings(data);
      // If not currently searching, update displayed meetings too
      // This ensures the list updates if a meeting finishes processing while viewing the full list
      if (!searchQuery) {
        setDisplayedMeetings(data);
      }
      setError(null); // Clear previous errors on successful fetch
    } catch (err) {
      // Set error if initial fetch fails
      setError("Failed to load meetings. Please try again.");
      console.error("Fetch meetings error:", err);
    } finally {
      // Stop loading indicator after initial fetch attempt
      setIsLoading(false);
    }
  }, []); // fetchMeetings is now only for initial load


  // Effect for initial fetch and WebSocket connection
  useEffect(() => {
    // 1. Initial Fetch
    fetchMeetings();

    // 2. Establish WebSocket Connection
    // Determine WebSocket URL based on current protocol and host
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    // Assuming backend runs on port 7000 relative to frontend host
    const host = "localhost"; // Explicitly set hostname for Electron compatibility
    const wsUrl = `${proto}//${host}:7000/meetings/ws`; // Corrected port to 7000

    console.log(`Attempting to connect WebSocket to: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connection established");
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log("WebSocket message received:", message);

        setAllMeetings(prevMeetings => {
          let updatedMeetings = [...prevMeetings];
          switch (message.type) {
            case "meeting_created": {
              // Add new meeting if it doesn't exist already
              if (!updatedMeetings.some(m => m.id === message.payload.id)) {
                updatedMeetings.push(message.payload);
              }
              break;
            }
            case "meeting_updated": {
              // Find and replace existing meeting
              const index = updatedMeetings.findIndex(m => m.id === message.payload.id);
              if (index !== -1) {
                updatedMeetings[index] = message.payload;
              } else {
                // If not found, maybe add it? Or log warning. Adding for robustness.
                console.warn(`Received update for unknown meeting ID: ${message.payload.id}. Adding it.`);
                updatedMeetings.push(message.payload);
              }
              break;
            }
            case "meeting_deleted": {
              // Filter out the deleted meeting
              updatedMeetings = updatedMeetings.filter(m => m.id !== message.payload.id);
              break;
            }
            default:
              console.warn("Unknown WebSocket message type:", message.type);
          }
          // Return the sorted list
          return sortMeetings(updatedMeetings);
        });
      } catch (error) {
        console.error("Failed to parse WebSocket message or update state:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      // Optionally set an error state for the UI
      setError("Real-time connection error. List may not update automatically.");
    };

    ws.onclose = (event) => {
      console.log("WebSocket connection closed:", event.code, event.reason);
      wsRef.current = null;
      // Optionally implement reconnection logic here
      // setError("Real-time connection closed. List may not update automatically.");
    };

    // 3. Cleanup on unmount
    return () => {
      console.log("Closing WebSocket connection");
      wsRef.current?.close();
    };
  }, [fetchMeetings]); // Run once on mount, depend on fetchMeetings


  // Updated for real-time search - API search is triggered explicitly
  const handleSearch = useCallback(async (query: string) => {
    const trimmedQuery = query.trim().toLowerCase();
    setSearchQuery(trimmedQuery);
    
    if (!trimmedQuery) {
      setDisplayedMeetings(allMeetings);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    // Set searching state immediately
    setIsSearching(true);
    setSearchError(null);
    
    // First perform local search for instant feedback
    const localResults = allMeetings.filter(meeting => 
      meeting.filename.toLowerCase().includes(trimmedQuery) || 
      meeting.summary?.toLowerCase().includes(trimmedQuery)
    );
    
    // Show local results immediately
    setDisplayedMeetings(localResults);
    
    // Then do server search for more comprehensive results
    try {
      const apiResults = await api.searchTranscript(trimmedQuery);
      // Sort results like the main list
      apiResults.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
      setDisplayedMeetings(apiResults);
    } catch (err) {
      // If API search fails, we still have the local results displayed
      setSearchError("Full transcript search failed. Showing partial results.");
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  }, [allMeetings]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    setSearchError(null);
    setDisplayedMeetings(allMeetings); // Reset display to the full list
    setIsSearching(false); // Ensure searching state is reset
  }, [allMeetings]); // Depend on allMeetings

  // Function to handle meeting deletion
  const handleDeleteMeeting = useCallback((meetingId: string) => {
    // Optimistically remove from both lists
    const originalAllMeetings = [...allMeetings];
    const originalDisplayedMeetings = [...displayedMeetings];

    setAllMeetings(prev => prev.filter(m => m.id !== meetingId));
    setDisplayedMeetings(prev => prev.filter(m => m.id !== meetingId));

    // No need to call api.deleteMeeting here, as it's already called in MeetingCard
    // The MeetingCard handles the API call and toast notifications.
    // This function only needs to update the local state based on the callback.

    // If the API call in MeetingCard fails, it shows a toast.
    // We don't need complex rollback logic here if MeetingCard handles errors.
    // The list will simply be out of sync until the next fetch if deletion fails silently,
    // but the user gets feedback via the toast.
    // Optimistic update is handled by the MeetingCard calling the onDelete prop,
    // which updates the state directly in this hook via setAllMeetings.
    // The WebSocket 'meeting_deleted' message provides the definitive update later.
    setAllMeetings(prev => prev.filter(m => m.id !== meetingId));
    // displayedMeetings will update via the useEffect watching allMeetings

    // The api.deleteMeeting call is handled within the MeetingCard component.
    // This function is the callback passed *to* MeetingCard.

  }, []); // No dependencies needed as state updates via WebSocket

  return {
    allMeetings,
    displayedMeetings,
    isLoading,
    error,
    isSearching,
    searchError,
    searchQuery,
    fetchMeetings: () => fetchMeetings(), // Expose fetchMeetings for manual refresh/retry
    handleSearch,
    handleClearSearch,
    handleDeleteMeeting, // Expose the delete handler
  };
}
