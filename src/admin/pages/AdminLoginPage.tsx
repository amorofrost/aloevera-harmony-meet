import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { authApi } from "@/services/api/authApi";
import { apiClient } from "@/services/api/apiClient";
import { isApiMode } from "@/config/api.config";
import { getStaffRoleFromAccessToken } from "@/lib/jwt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const token = apiClient.getAccessToken();
  if (getStaffRoleFromAccessToken(token) === "admin") {
    return <Navigate to="/users" replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isApiMode()) {
      toast.error("Admin requires API mode (VITE_API_MODE=api).");
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      if (!res.success || !res.data?.accessToken) {
        toast.error(res.error?.message ?? "Login failed");
        return;
      }
      const role = getStaffRoleFromAccessToken(res.data.accessToken);
      if (role !== "admin") {
        toast.error("This account is not an administrator.");
        return;
      }
      apiClient.setAccessToken(res.data.accessToken);
      if (res.data.refreshToken) {
        apiClient.setRefreshToken(res.data.refreshToken);
      }
      navigate("/users", { replace: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Admin sign-in</CardTitle>
          <CardDescription>
            Use an account with the <code className="text-xs">admin</code> staff role (e.g.{" "}
            <code className="text-xs">test@example.com</code> after seeding).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
