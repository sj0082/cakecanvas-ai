// =============================================================================
// Application Entry Point
// Technical Building Block: P01 - Application Bootstrap with i18n
// =============================================================================

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n/config";

createRoot(document.getElementById("root")!).render(<App />);
