import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const CHUNK_RELOAD_KEY = "ff-chunk-reload";

function isChunkLoadError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message || error || "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk \d+ failed|error loading dynamically imported module|Unable to preload CSS/i.test(message);
}

function reloadOnceForStaleChunk() {
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
  } catch {
    // sessionStorage may be unavailable; still try a single reload
  }
  window.location.reload();
}

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  reloadOnceForStaleChunk();
});

window.addEventListener("unhandledrejection", (event) => {
  if (isChunkLoadError(event.reason)) {
    event.preventDefault();
    reloadOnceForStaleChunk();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
