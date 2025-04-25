import { MeetingCard } from "./MeetingCard";
import { Meeting } from "@/services/api";

interface GridProps {
  meetings: Meeting[];
  // Removed onDelete prop
}

export function Grid({ meetings }: GridProps) { // Removed onDelete from props
  if (!meetings || meetings.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {meetings.map((meeting) => (
        <MeetingCard
          key={meeting.id || `meeting-${Math.random().toString(36).substr(2, 9)}`}
          meeting={meeting}
          // Removed onDelete prop pass-down
        />
      ))}
    </div>
  );
}
