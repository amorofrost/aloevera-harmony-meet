import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { apiClient } from "@/services/api/apiClient";
import { getStaffRoleFromAccessToken } from "@/lib/jwt";
import AdminLoginPage from "./pages/AdminLoginPage";
import AdminLayout from "./components/AdminLayout";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminConfigPage from "./pages/AdminConfigPage";
import AdminEventsPage from "./pages/AdminEventsPage";
import AdminEventEditorPage from "./pages/AdminEventEditorPage";
import AdminInvitesPage from "./pages/AdminInvitesPage";
import AdminForumPage from "./pages/AdminForumPage";
import AdminForumSectionTopicsPage from "./pages/AdminForumSectionTopicsPage";
import AdminStorePage from "./pages/AdminStorePage";
import AdminBlogPage from "./pages/AdminBlogPage";

function RequireAdmin() {
  const token = apiClient.getAccessToken();
  if (getStaffRoleFromAccessToken(token) !== "admin") {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

export default function AdminApp() {
  return (
    <BrowserRouter basename="/admin">
      <Routes>
        <Route path="/login" element={<AdminLoginPage />} />
        <Route element={<RequireAdmin />}>
          <Route element={<AdminLayout />}>
            <Route path="/" element={<Navigate to="/users" replace />} />
            <Route path="/users" element={<AdminUsersPage />} />
            <Route path="/events" element={<AdminEventsPage />} />
            {/* Single dynamic route so :eventId is "new" for /events/new (static route would omit params). */}
            <Route path="/events/:eventId" element={<AdminEventEditorPage />} />
            <Route path="/invites" element={<AdminInvitesPage />} />
            <Route path="/forum" element={<AdminForumPage />} />
            <Route path="/forum/:sectionId" element={<AdminForumSectionTopicsPage />} />
            <Route path="/store" element={<AdminStorePage />} />
            <Route path="/blog" element={<AdminBlogPage />} />
            <Route path="/config" element={<AdminConfigPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
