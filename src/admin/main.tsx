import { createRoot } from "react-dom/client";
import AdminApp from "./AdminApp";
import "../index.css";
import { Toaster } from "@/components/ui/sonner";

createRoot(document.getElementById("root")!).render(
  <>
    <AdminApp />
    <Toaster />
  </>
);
