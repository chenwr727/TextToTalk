import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export function findChromium(configured?: string): string | undefined {
  if (configured && fs.existsSync(configured)) return configured;

  const candidates: string[] = [];
  if (process.platform === "win32") {
    const bases = [
      process.env["ProgramFiles(x86)"],
      process.env["ProgramFiles"],
      process.env["LOCALAPPDATA"],
    ].filter(Boolean) as string[];
    for (const base of bases) {
      candidates.push(path.join(base, "Microsoft", "Edge", "Application", "msedge.exe"));
      candidates.push(path.join(base, "Google", "Chrome", "Application", "chrome.exe"));
    }
  } else if (process.platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    );
  } else {
    for (const bin of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"]) {
      candidates.push(path.join("/usr/bin", bin), path.join("/usr/local/bin", bin));
    }
  }

  return candidates.find((p) => fs.existsSync(p));
}

export function findFfmpeg(bin: string, extraBinDir?: string): string | undefined {
  const ext = process.platform === "win32" ? ".exe" : "";
  const name = bin + ext;
  if (extraBinDir) {
    const local = path.join(extraBinDir, name);
    if (fs.existsSync(local)) return local;
  }
  try {
    const cmd = process.platform === "win32" ? "where" : "which";
    const out = execFileSync(cmd, [bin], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
    const first = out.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
    if (first) return first;
  } catch {
  }
  return undefined;
}
