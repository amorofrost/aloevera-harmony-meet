import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
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
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/talks" element={<Talks />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/aloevera" element={<AloeVera />} />
            <Route path="/aloevera/events/:eventId" element={<EventDetails />} />
            <Route path="/aloevera/blog/:postId" element={<BlogPost />} />
            <Route path="/aloevera/store/:itemId" element={<StoreItem />} />
            <Route path="/settings" element={<SettingsPage />} />
            {/* Legacy redirects */}
            <Route path="/search" element={<Navigate to="/friends" replace />} />
            <Route path="/events" element={<Navigate to="/aloevera" replace />} />
            <Route path="/events/:eventId" element={<Navigate to="/aloevera" replace />} />
            <Route path="/likes" element={<Navigate to="/friends" replace />} />
            <Route path="/chats" element={<Navigate to="/talks" replace />} />
            <Route path="/profile" element={<Navigate to="/settings" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
