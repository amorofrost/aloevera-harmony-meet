/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/** Dev-only: serve `admin.html` for `/admin` and `/admin/*` so React Router basename `/admin` matches the URL bar. */
function adminHtmlFallback() {
  return {
    name: "admin-html-fallback",
    configureServer(server: any) {
      server.middlewares.use((req: any, _res: any, next: any) => {
        const raw = req.url ?? "";
        const pathname = raw.split("?")[0];
        if (pathname === "/admin" || pathname.startsWith("/admin/")) {
          const q = raw.includes("?") ? "?" + raw.split("?")[1] : "";
          req.url = "/admin.html" + q;
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  server: { host: "::", port: 8080 },
  plugins: [
    react(),
    adminHtmlFallback(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        admin: path.resolve(__dirname, "admin.html"),
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    env: {
      VITE_API_MODE: "mock",
    },
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/pages/Welcome.tsx"],
    },
  },
}));
