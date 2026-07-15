import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import { ErrorBoundary } from "./ErrorBoundary";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
