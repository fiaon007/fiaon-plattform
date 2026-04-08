import { createRoot } from "react-dom/client";
import App from "./App";
import { ToastProvider } from "./components/ui/toast-provider";
import "./index.css";
import "./styles/animations.css";
import "./styles/pricing.css";
import "./styles/industry-atlas.css";

createRoot(document.getElementById("root")!).render(
  <ToastProvider>
    <App />
  </ToastProvider>
);
