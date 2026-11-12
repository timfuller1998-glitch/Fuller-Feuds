import fs from "fs";
import path from "path";

export type BuildInfo = {
  sha: string;
  shortSha: string;
  builtAt: string | null;
  version: string;
};

function readVersionFile(): BuildInfo | null {
  const candidates = [
    path.resolve(process.cwd(), "dist", "public", "version.json"),
    path.resolve(import.meta.dirname, "..", "dist", "public", "version.json"),
  ];
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
        const sha = String(raw.sha || "").trim();
        if (!sha) continue;
        return {
          sha,
          shortSha: String(raw.shortSha || sha.slice(0, 7)),
          builtAt: raw.builtAt ? String(raw.builtAt) : null,
          version: String(raw.version || "1.0.0"),
        };
      }
    } catch {
      // try the next path
    }
  }
  return null;
}

export function getBuildInfo(): BuildInfo {
  const fromFile = readVersionFile();
  if (fromFile) return fromFile;
  const sha = (process.env.RENDER_GIT_COMMIT || process.env.FF_BUILD_SHA || "unknown").trim();
  return {
    sha,
    shortSha: sha.slice(0, 7),
    builtAt: null,
    version: "1.0.0",
  };
}
