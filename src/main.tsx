import { createRoot } from 'react-dom/client';
import { ThemeProvider } from "next-themes"; // Import ThemeProvider
import App from './App.tsx';
import './index.css';
import './types/electron.d.ts'; // Import for side effects to load global types
import "@fontsource/inter/400.css"; // Regular weight
import "@fontsource/inter/700.css"; // Bold weight

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <App />
  </ThemeProvider>
);
