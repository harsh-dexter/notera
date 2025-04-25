import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils"; // Import cn for conditional classes
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton

// Assuming ActionItem type is defined like this, adjust if necessary
// (Ideally, this should be imported from where it's defined, e.g., services/api)
type ActionItem = {
  id: string; // Or number, depending on your API
  description: string;
  // Add other properties if needed, e.g., assignee, due date
};

interface ActionItemsCardProps {
  actionItems: ActionItem[] | null | undefined;
  isLoading?: boolean; // Add isLoading prop
}

export function ActionItemsCard({ actionItems, isLoading }: ActionItemsCardProps) { // Add isLoading
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  // Render null only if not loading and no items exist
  if (isLoading !== true && (!actionItems || actionItems.length === 0)) {
    return null;
  }

  const handleCheckedChange = (itemId: string, isChecked: boolean) => {
    setCheckedItems(prev => ({
      ...prev,
      [itemId]: isChecked,
    }));
  };

  // Mapping is now done inside the return statement below

  return (
    <Card>
      <CardHeader>
        <CardTitle>Action Items</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          // Show skeleton loaders when loading
          <div className="space-y-3">
            {[...Array(3)].map((_, index) => ( // Render 3 skeleton items
              <div key={index} className="flex items-start gap-3">
                <Skeleton className="h-5 w-5 rounded mt-1" /> {/* Skeleton for checkbox */}
                <Skeleton className="h-4 w-full" /> {/* Skeleton for label */}
              </div>
            ))}
          </div>
        ) : (
          // Show actual action items when not loading
          <ul className="space-y-3">
            {/* Map over actionItems only if it exists and is not loading */}
            {actionItems?.map((item, index) => {
              // Ensure items have a unique ID for state management within the map
              const guaranteedId = item.id || `temp-action-item-${index}`;
              return (
                <li key={guaranteedId} className="flex items-start gap-3">
                  <Checkbox
                    id={guaranteedId}
                    checked={!!checkedItems[guaranteedId]}
                    onCheckedChange={(checked) => handleCheckedChange(guaranteedId, !!checked)}
                    className="mt-1" // Align checkbox slightly better with text
                  />
                  <label
                    htmlFor={guaranteedId}
                    className={cn(
                      "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
                      checkedItems[guaranteedId] && "line-through text-muted-foreground" // Apply strikethrough
                    )}
                  >
                    {item.description}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
