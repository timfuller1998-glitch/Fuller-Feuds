import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Google AdSense (Fuller Feuds Dev, Nov 20 2026): only when VITE_ADSENSE_CLIENT is a ca-pub id at
// build time, add the account meta tag and the adsbygoogle loader to <head>. See docs/ADSENSE.md.
function adsenseHead(): Plugin {
  return {
    name: "ff-adsense-head",
    transformIndexHtml() {
      const client = (process.env.VITE_ADSENSE_CLIENT || "").trim();
      if (!/^ca-pub-\d{10,20}$/.test(client)) return [];
      return [
        { tag: "meta", attrs: { name: "google-adsense-account", content: client }, injectTo: "head" },
        {
          tag: "script",
          attrs: {
            async: true,
            src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`,
            crossorigin: "anonymous",
          },
          injectTo: "head",
        },
      ];
    },
  };
}

export default defineConfig({
  plugins: [react(), adsenseHead()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  // Root is client/, so the default publicDir (client/public) does not exist.
  // Static PWA files live in the repo-level public/ folder and must be copied
  // into dist/public so production can serve a single build directory.
  publicDir: path.resolve(import.meta.dirname, "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
