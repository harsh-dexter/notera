import { useLocation, Link } from "react-router-dom"; // Import Link
import { useEffect } from "react";
import { PageLayout } from "@/components/layout/page-layout"; // Import PageLayout

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    // Use PageLayout for consistency
    <PageLayout> 
      <div className="container flex items-center justify-center py-20"> {/* Use container and padding */}
        <div className="text-center">
          <h1 className="text-6xl font-bold mb-4 text-foreground">404</h1> {/* Larger text, use foreground */}
          <p className="text-2xl text-muted-foreground mb-6">Oops! Page not found</p> {/* Larger text, use muted foreground */}
          {/* Use Link component and primary color */}
          <Link to="/" className="text-primary hover:underline font-medium"> 
            Return to Home
          </Link>
        </div>
      </div>
    </PageLayout>
  );
};

export default NotFound;
