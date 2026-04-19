import { Link, Outlet, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/services/api/apiClient";

export default function AdminLayout() {
  const navigate = useNavigate();

  function signOut() {
    apiClient.clearTokens();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background">
        <div className="container flex h-14 max-w-6xl items-center gap-6 px-4">
          <span className="font-semibold tracking-tight">AloeVera Admin</span>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link to="/users" className="hover:text-foreground">
              Users
            </Link>
            <Link to="/events" className="hover:text-foreground">
              Events
            </Link>
            <Link to="/invites" className="hover:text-foreground">
              Invites
            </Link>
            <Link to="/forum" className="hover:text-foreground">
              Forum
            </Link>
            <Link to="/store" className="hover:text-foreground">
              Store
            </Link>
            <Link to="/blog" className="hover:text-foreground">
              Blog
            </Link>
            <Link to="/config" className="hover:text-foreground">
              App config
            </Link>
          </nav>
          <div className="ml-auto">
            <Button variant="outline" size="sm" type="button" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="container max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
