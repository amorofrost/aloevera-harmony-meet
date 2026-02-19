import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { isMockMode } from "@/config/api.config";
import ProtectedRoute from "@/components/ProtectedRoute";
import Welcome from "./pages/Welcome";
import Talks from "./pages/Talks";
import Friends from "./pages/Friends";
import AloeVera from "./pages/AloeVera";
import EventDetails from "./pages/EventDetails";
import BlogPost from "./pages/BlogPost";
import StoreItem from "./pages/StoreItem";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {isMockMode() && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500/90 backdrop-blur-sm text-black px-4 py-2 text-center text-sm font-medium shadow-lg">
            🔧 DEBUG MODE: Running with mock data (no backend connection)
          </div>
        )}
        <BrowserRouter>
          <div className={isMockMode() ? "pt-10" : ""}>
            <Routes>
              {/* Public — authentication page */}
              <Route path="/" element={<Welcome />} />

              {/* Protected — require a valid JWT */}
              <Route path="/friends" element={<ProtectedRoute><Friends /></ProtectedRoute>} />
              <Route path="/talks" element={<ProtectedRoute><Talks /></ProtectedRoute>} />
              <Route path="/aloevera" element={<ProtectedRoute><AloeVera /></ProtectedRoute>} />
              <Route path="/aloevera/events/:eventId" element={<ProtectedRoute><EventDetails /></ProtectedRoute>} />
              <Route path="/aloevera/blog/:postId" element={<ProtectedRoute><BlogPost /></ProtectedRoute>} />
              <Route path="/aloevera/store/:itemId" element={<ProtectedRoute><StoreItem /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

              {/* Legacy redirects */}
              <Route path="/search" element={<Navigate to="/friends" replace />} />
              <Route path="/events" element={<Navigate to="/aloevera" replace />} />
              <Route path="/events/:eventId" element={<Navigate to="/aloevera" replace />} />
              <Route path="/likes" element={<Navigate to="/friends" replace />} />
              <Route path="/chats" element={<Navigate to="/talks" replace />} />
              <Route path="/profile" element={<Navigate to="/settings" replace />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
