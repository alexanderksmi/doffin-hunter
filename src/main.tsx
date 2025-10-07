import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { KeywordsProvider } from "./contexts/KeywordsContext";
import App from "./App.tsx";
import "./index.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <KeywordsProvider>
        <App />
      </KeywordsProvider>
    </QueryClientProvider>
  </StrictMode>
);
