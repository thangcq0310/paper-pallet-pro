import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";

const queryClient = new QueryClient();
const router = getRouter();

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

if ("serviceWorker" in navigator && (import.meta.env.PROD || window.location.hostname === "localhost")) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
