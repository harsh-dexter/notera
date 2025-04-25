
import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "next-themes"; // Import useTheme
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"; // Import Dropdown components
import { Wand2, Sun, Moon } from "lucide-react"; // Import theme icons

interface PageLayoutProps {
  children: ReactNode;
}

export function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background"> {/* Ensure main background */}
      <header className="border-b bg-background shadow-sm sticky top-0 z-10"> {/* Use background, add shadow, make sticky */}
        <div className="container py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          {/* Wrap logo/title in a Link */}
          <Link to="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
            <Wand2 className="h-8 w-8 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">Notera</h1> {/* Updated Name */}
          </Link>
          <nav className="flex items-center space-x-2"> {/* Use flex and adjust spacing */}
            <Button variant="ghost" asChild>
              <Link to="/meetings">View Meetings</Link>
            </Button>
            <Button asChild>
              <Link to="/">Upload New</Link>
            </Button>

            {/* Theme Toggle Dropdown */}
            <ThemeToggle />

          </nav>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="bg-secondary border-t"> {/* Use secondary background */}
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Notera. All rights reserved. {/* Updated Name */}
        </div>
      </footer>
    </div>
  );
}


function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
