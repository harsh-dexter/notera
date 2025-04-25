
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/page-layout";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useMeetingsList } from "@/hooks/use-meetings-list";
import { ListHeader } from "@/components/meetings-list/ListHeader"; // Renamed import
import { Grid } from "@/components/meetings-list/Grid"; // Renamed import
import { EmptyState } from "@/components/meetings-list/EmptyState"; // Renamed import
import { SearchEmptyState } from "@/components/meetings-list/SearchEmptyState"; // Renamed import

export default function MeetingsList() {
  const {
    allMeetings,
    displayedMeetings,
    isLoading,
    error,
    isSearching,
    searchError,
    searchQuery,
    fetchMeetings, // Renamed from refetchMeetings in hook if needed, using hook's name here
    handleSearch,
    handleClearSearch,
    // Removed handleDeleteMeeting from hook destructuring
  } = useMeetingsList();

  // Determine if the initial load is happening (loading state is true AND no meetings have ever been loaded)
  const isInitialLoading = isLoading && allMeetings.length === 0;

  // Removed the first (incorrect) renderContent and onDeleteMeeting definitions

  // Helper function to render the main content based on state
  const renderContent = () => {
    // 1. Initial Loading State
    if (isInitialLoading) {
      return (
        <div className="flex justify-center items-center h-64">
          <Spinner size="lg" text="Loading meetings..." />
        </div>
      );
    }

    // 2. Initial Load Error State
    if (error && allMeetings.length === 0) {
      return (
        <Alert variant="destructive" className="text-center">
          <AlertTitle>Error Loading Meetings</AlertTitle>
          <AlertDescription>
            {error}
            <Button variant="outline" className="mt-2" onClick={() => fetchMeetings()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    // 3. Search Error State (Renumbered from 4)
    if (searchError && searchError.includes("Failed")) {
        // Note: Grid might still show local results below this error
        return (
           <Alert variant="destructive" className="text-center">
             <AlertTitle>Search Error</AlertTitle>
             <AlertDescription>
               {searchError}
               <Button variant="outline" className="mt-2" onClick={() => handleSearch(searchQuery)}>
                 Retry Search
               </Button>
             </AlertDescription>
           </Alert>
        );
    }

    // 4. No Meetings Ever Uploaded State (Renumbered from 5)
    // Display this only if not searching and no meetings exist
    if (allMeetings.length === 0 && !searchQuery && !isSearching) {
      return <EmptyState />;
    }

    // 5. Display Meetings Grid (Renumbered)
    // Show grid whenever there are meetings to display.
    // The hook updates displayedMeetings with local results first, then API results.
    if (displayedMeetings.length > 0) {
       // Removed onDelete prop from Grid
       return <Grid meetings={displayedMeetings} />;
    }


    // 6. No Matching Search Results State (Renumbered)
    // Display this if a search was performed (searchQuery exists),
    // the search is no longer running (!isSearching),
    // there was no error (!searchError),
    // and no meetings are currently displayed.
    if (searchQuery && !isSearching && !searchError && displayedMeetings.length === 0) {
      return <SearchEmptyState searchQuery={searchQuery} />;
    }

    // Fallback case (should ideally not be reached with proper state handling)
    return null;
  };

  return (
    <PageLayout>
      <div className="container px-4 py-8 sm:px-6 lg:px-8">
        <ListHeader // Renamed component
          searchQuery={searchQuery}
          isSearching={isSearching}
          onSearch={handleSearch}
          onClearSearch={handleClearSearch}
        />
        {renderContent()}
      </div>
    </PageLayout>
  );
}
