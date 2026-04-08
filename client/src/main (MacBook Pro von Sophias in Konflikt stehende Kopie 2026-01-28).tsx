import { createRoot } from "react-dom/client";
import App from "./App";
import { ToastProvider } from "./components/ui/toast-provider";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";
import "./styles/animations.css";

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <ToastProvider>
      <App />
    </ToastProvider>
  </ErrorBoundary>
);
