
import { UploadForm } from "@/components/upload/UploadForm";
import { SystemAudioRecorder } from "@/components/recording/SystemAudioRecorder"; // Import the new recorder component
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Import Tabs components
import { ListChecks, FileAudio, Search, Download, UploadCloud, Mic } from "lucide-react"; // Added UploadCloud, Mic icons
import { PageLayout } from "@/components/layout/page-layout";

export default function Home() {
  return (
    <PageLayout>
      <div className="container px-4 py-12 sm:py-16 sm:px-6 lg:px-8"> {/* Increased padding */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center"> {/* Increased gap */}
          <div className="space-y-8"> {/* Increased spacing */}
            <div className="space-y-3"> {/* Increased spacing */}
              <h2 className="text-4xl font-bold tracking-tight sm:text-5xl text-foreground"> {/* Larger, use foreground */}
                Transform your meetings with AI
              </h2>
              <p className="text-xl text-muted-foreground"> {/* Larger, use muted foreground */}
                Upload audio, get summaries, action items, and searchable transcripts.
              </p>
            </div>

            <div className="space-y-4"> {/* Increased spacing */}
              {/* Feature Item 1 */}
              <div className="flex items-start"> {/* Use items-start */}
                <div className="bg-primary/10 p-2 rounded-lg mr-4 flex-shrink-0"> {/* Added flex-shrink-0 */}
                  <FileAudio className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Multilingual Support</h3> {/* Bolder, use foreground */}
                  <p className="text-sm text-muted-foreground mt-0.5"> {/* Adjusted margin */}
                    Process recordings in multiple languages accurately.
                  </p>
                </div>
              </div>
              {/* Feature Item 2 */}
              <div className="flex items-start">
                <div className="bg-primary/10 p-2 rounded-lg mr-4 flex-shrink-0">
                  <ListChecks className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Extract Action Items</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Automatically identify and organize key tasks.
                  </p>
                </div>
              </div>
              {/* Feature Item 3 */}
              <div className="flex items-start">
                <div className="bg-primary/10 p-2 rounded-lg mr-4 flex-shrink-0">
                  <Search className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Searchable Transcripts</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Quickly find key moments with full-text search.
                  </p>
                </div>
              </div>
              {/* Feature Item 4 */}
              <div className="flex items-start">
                <div className="bg-primary/10 p-2 rounded-lg mr-4 flex-shrink-0">
                  <Download className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Export Reports</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Download summaries and action items as PDF.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Input Section (Tabs) */}
          <div className="bg-card border border-border p-6 md:p-8 rounded-2xl shadow-sm relative animate-fade-in">
             <Tabs defaultValue="upload" className="w-full">
               <TabsList className="grid w-full grid-cols-2 mb-6">
                 <TabsTrigger value="upload">
                   <UploadCloud className="mr-2 h-4 w-4" /> Upload File
                 </TabsTrigger>
                 <TabsTrigger value="record">
                   <Mic className="mr-2 h-4 w-4" /> Record Audio
                 </TabsTrigger>
               </TabsList>
               <TabsContent value="upload">
                 <h2 className="text-xl font-semibold mb-4 text-center text-foreground">Upload Meeting Audio</h2>
                 <UploadForm />
               </TabsContent>
               <TabsContent value="record">
                 <h2 className="text-xl font-semibold mb-4 text-center text-foreground">Record System Audio</h2>
                 <SystemAudioRecorder />
               </TabsContent>
             </Tabs>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
