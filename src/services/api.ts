/**
 * API service for the Meeting Note-Taker application
 * This service handles all communication with the backend API
 */

// Base URL for the FastAPI backend
const BASE_URL = "http://localhost:7000"; // Backend runs on port 7000

// Types
export interface Meeting { // Keep existing type, but note backend might return different structure initially
  id: string;
  filename: string;
  uploadDate: string;
  status: "processing_asr" | "processing_analysis" | "completed" | "failed" | "recording_live"; // Added recording_live
  languages?: string[];
  duration?: string;
  summary?: string;
  actionItems?: ActionItem[];
  decisions?: ActionItem[]; // Add decisions field (using ActionItem structure for now)
  error?: string;
}

export interface ActionItem {
  id: string;
  description: string;
  assignee?: string;
  dueDate?: string;
}

export interface TranscriptSegment {
  id: string;
  speakerId: string;
  speakerName?: string;
  startTime: number;
  endTime: number;
  text: string;
  language?: string;
}

export interface SearchResult {
  segmentId: string;
  text: string;
  matchPositions: [number, number][];
} // <-- Added missing closing brace

// Helper function for handling API errors
async function handleApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorDetail = `HTTP error! status: ${response.status}`;
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorDetail;
    } catch (jsonError) {
      // Ignore if response is not JSON
    }
    throw new Error(errorDetail);
  }
  return response.json() as Promise<T>;
}

// API Functions
export const api = {
  uploadMeeting: async (file: File): Promise<Meeting> => {
    const formData = new FormData();
    formData.append("file", file, file.name);

    const response = await fetch(`${BASE_URL}/upload/upload-audio`, {
      method: "POST",
      body: formData,
    });

    // Use helper to handle potential errors and parse JSON
    // Expect the full initial meeting data structure from the backend now
    const initialMeetingData = await handleApiResponse<Meeting>(response); 

    // The backend now returns the initial meeting object directly
    // Ensure the returned object matches the Meeting interface
    // (Type assertion might be needed if backend keys differ slightly, e.g., job_id vs id)
    // Explicitly map upload_time from backend response to uploadDate in frontend object
    const backendUploadTime = (initialMeetingData as any).upload_time; // Access the correct field

    return {
        ...initialMeetingData,
        id: initialMeetingData.id || (initialMeetingData as any).job_id, // Handle potential key mismatch
        // Use the backend time if available, otherwise fallback (though backend should always provide it now)
        uploadDate: backendUploadTime || new Date().toISOString(),
        status: initialMeetingData.status || "processing_asr", // Ensure status is present, default to initial stage
    };
  },

  // Get all meetings
  getMeetings: async (): Promise<Meeting[]> => {
    const response = await fetch(`${BASE_URL}/meetings/`);
    // Define the expected structure from the backend based on storage.py
    const backendData = await handleApiResponse<Array<{
      id: string; // Expect 'id' from backend now
      filename: string;
      transcript: string | null;
      summary: string | null;
      action_items: string; // Expect JSON string from DB
      decisions: string;    // Expect JSON string from DB
      status: Meeting["status"]; // Expect status field from backend
      upload_time: string; // Expect 'upload_time' from backend now
      languages: string[]; // Expect languages array from backend
    }>>(response);

    // Map backend data to frontend Meeting type
    return backendData.map((item): Meeting => {
      // Backend already decodes JSON strings into arrays, directly use them.
      // Ensure they are arrays, default to empty array if not.
      const actionItemsList = Array.isArray(item.action_items) ? item.action_items : [];
      const decisionsList = Array.isArray(item.decisions) ? item.decisions : [];

      return {
        id: item.id, // Use 'id' directly from backend
        filename: item.filename || 'N/A',
        uploadDate: item.upload_time || null, // Use 'upload_time' from backend, fallback to null
        status: item.status || "processing_asr", // Use status directly from backend, fallback to processing_asr
        languages: item.languages || [], // Map languages array
        summary: item.summary || undefined,
        // Map string arrays to ActionItem arrays
        actionItems: actionItemsList.map((desc, index) => ({ id: `${item.id}-action-${index}`, description: desc })), // Use item.id
        decisions: decisionsList.map((desc, index) => ({ id: `${item.id}-decision-${index}`, description: desc })), // Use item.id
        error: item.status === "failed" ? (item.summary || "Processing failed") : undefined, // Use status for error indication
        // language and duration are not directly available in the list view from backend
      };
    });
  },

  // Get a single meeting by ID (job_id)
  getMeeting: async (id: string): Promise<Meeting> => {
    // This endpoint fetches summary, actions, decisions
    const response = await fetch(`${BASE_URL}/meetings/summary/${id}`); // Endpoint path still uses job_id conceptually, but backend function uses it as 'id'
    const data = await handleApiResponse<{
      id: string; // Expect 'id' from backend now
      summary: string | null;
      action_items: string; // Expect JSON string
      decisions: string; // Expect JSON string
      // Assume summary endpoint also returns status, filename, upload_time, languages now
      status: Meeting["status"];
      filename: string;
      upload_time: string; // Expect 'upload_time' from backend now
      languages: string[]; // Expect languages array from backend
    }>(response);

    // No need to fetch full data separately if summary endpoint returns all needed fields
    // const fullDataResponse = await fetch(`${BASE_URL}/meetings/json/${id}`); 
    // const fullData = await handleApiResponse<any>(fullDataResponse); 

    // Backend already decodes JSON strings into arrays, directly use them.
    // Ensure they are arrays, default to empty array if not.
    const actionItemsList = Array.isArray(data.action_items) ? data.action_items : [];
      const decisionsList = Array.isArray(data.decisions) ? data.decisions : [];

    return {
      id: data.id, // Use 'id' directly from backend
      filename: data.filename || 'N/A', // Use filename from summary response
      uploadDate: data.upload_time || null, // Use 'upload_time' from backend, fallback to null
      status: data.status || "processing_asr", // Use status directly from backend, fallback to processing_asr
      languages: data.languages || [], // Map languages array
      summary: data.summary || undefined,
      actionItems: actionItemsList.map((desc, index) => ({ id: `${data.id}-action-${index}`, description: desc })), // Use data.id
      decisions: decisionsList.map((desc, index) => ({ id: `${data.id}-decision-${index}`, description: desc })), // Use data.id
      error: data.status === "failed" ? (data.summary || "Processing failed") : undefined,
      // language: data.language || undefined, // Get language if available in summary response
      // duration would need calculation or backend storage
    };
  },

  // Get transcript for a meeting (job_id)
  // Note: Backend now stores transcript as a JSON string of TranscriptSegment[] for live recordings
  getTranscript: async (meetingId: string): Promise<TranscriptSegment[]> => {
    const response = await fetch(`${BASE_URL}/meetings/transcript/${meetingId}`);
    // Backend endpoint /meetings/transcript/{job_id} likely still just returns the raw column value
    const data = await handleApiResponse<{ job_id: string; transcript: string | null }>(response);

    if (!data.transcript) {
        console.log(`No transcript content found for meeting ${meetingId}`);
        return [];
    }

    try {
        // Attempt to parse the transcript string as JSON array of segments
        const segments = JSON.parse(data.transcript);
        if (Array.isArray(segments)) {
            // TODO: Add validation here to ensure objects match TranscriptSegment structure if needed
            console.log(`Parsed transcript JSON for meeting ${meetingId}`);
            return segments as TranscriptSegment[];
        } else {
            console.warn(`Transcript for meeting ${meetingId} was not a valid JSON array.`);
            return []; // Return empty if not an array
        }
    } catch (error) {
        // If parsing fails, it might be old plain text format or invalid JSON
        console.warn(`Failed to parse transcript as JSON for meeting ${meetingId}. Error: ${error}. Treating as plain text (split by line).`);
        // Fallback for potentially old, non-JSON transcripts (split by line)
        const lines = data.transcript.split('\n').filter(line => line.trim() !== '');
        return lines.map((line, index) => ({
            id: `${meetingId}-fallback-${index}`,
            speakerId: `speaker-unknown`,
            startTime: index * 5, // Mock time
            endTime: (index + 1) * 5, // Mock time
            text: line,
        }));
    }
  },

  // Search across ALL transcripts (global search)
  searchTranscript: async (query: string): Promise<Meeting[]> => {
    if (!query) return []; // Don't search if query is empty

    const response = await fetch(`${BASE_URL}/meetings/search/?query=${encodeURIComponent(query)}`);
    // Assume search results also include the 'status', languages and correct id/timestamp fields now
    const data = await handleApiResponse<{ query: string; results: Array<any & { id: string; upload_time: string; status: Meeting["status"]; languages: string[] }> }>(response);

    // Transform results to match Meeting interface
    return data.results.map((item): Meeting => {
      // Backend already decodes JSON strings into arrays, directly use them.
      // Ensure they are arrays, default to empty array if not.
      const actionItemsList = Array.isArray(item.action_items) ? item.action_items : [];
      const decisionsList = Array.isArray(item.decisions) ? item.decisions : [];

      return {
        id: item.id, // Use 'id' directly from backend
        filename: item.filename || item.id, // Use item.id as fallback filename
        uploadDate: item.upload_time || null, // Use 'upload_time' from backend, fallback to null
        status: item.status || "processing_asr", // Use status directly from backend search result, fallback to processing_asr
        languages: item.languages || [], // Map languages array
        summary: item.summary || "",
        actionItems: actionItemsList.map((desc, index) => ({ id: `${item.id}-action-${index}`, description: desc })), // Use item.id
        decisions: decisionsList.map((desc, index) => ({ id: `${item.id}-decision-${index}`, description: desc })), // Use item.id
        error: item.status === "failed" ? (item.summary || "Search result indicates failure") : undefined,
      };
    });
  },

  // Export meeting report as PDF
  exportMeetingReport: async (meetingId: string, includeTranscript: boolean = true): Promise<Blob> => {
    const response = await fetch(`${BASE_URL}/meetings/pdf/${meetingId}?include_transcript=${includeTranscript}`);
    if (!response.ok) {
        // Handle error similarly to handleApiResponse, but expect Blob on success
        let errorDetail = `HTTP error! status: ${response.status}`;
        try {
            const errorData = await response.json();
            errorDetail = errorData.detail || errorDetail;
        } catch (jsonError) { /* Ignore */ }
        throw new Error(errorDetail);
    }
    // Return the response body directly as a Blob
    return response.blob();
  },

  // Update meeting title
  updateMeetingTitle: async (meetingId: string, newTitle: string): Promise<{ message: string }> => {
    const response = await fetch(`${BASE_URL}/meetings/${meetingId}/title`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ new_title: newTitle }),
    });
    return handleApiResponse<{ message: string }>(response);
  },


  queryChat: async (meetingId: string, query: string): Promise<{ meeting_id: string; query: string; answer: string }> => {
    const response = await fetch(`${BASE_URL}/chat/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ meeting_id: meetingId, query: query }),
    });
    return handleApiResponse<{ meeting_id: string; query: string; answer: string }>(response);
  },

  // Delete a meeting
  deleteMeeting: async (meetingId: string): Promise<{ message: string }> => {
    const response = await fetch(`${BASE_URL}/meetings/${meetingId}`, {
      method: 'DELETE',
    });
    return handleApiResponse<{ message: string }>(response);
  },
};
