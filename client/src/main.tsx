import { createRoot } from "react-dom/client";
import Clarity from "@microsoft/clarity";
import App from "./App";
import "./index.css";

// Initialize Microsoft Clarity (runs once at app startup)
const clarityProjectId = "wf58sx5vcm";
Clarity.init(clarityProjectId);

createRoot(document.getElementById("root")!).render(<App />);
