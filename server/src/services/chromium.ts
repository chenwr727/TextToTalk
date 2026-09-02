import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";

const WINDOWS_CANDIDATES = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

const MAC_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

const COMMANDS = [
  "chromium",
  "chromium-browser",
  "google-chrome",
  "google-chrome-stable",
  "microsoft-edge",
  "microsoft-edge-stable",
];

let probeCache: string | null | undefined;

function exists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function commandPath(cmd: string): Promise<string | null> {
  return new Promise((resolve) => {
    const check = process.platform === "win32" ? "where" : "which";
    execFile(check, [cmd], { timeout: 5000, windowsHide: true }, (err, stdout) => {
      if (err) return resolve(null);
      const first = String(stdout).split(/\r?\n/)[0]?.trim();
      resolve(first || null);
    });
  });
}

export async function findSystemChromium(): Promise<string | null> {
  const fromCache = probeCache;
  if (fromCache !== undefined) return fromCache;

  let found: string | null = null;

  if (process.platform === "win32") {
    const userCandidates = [
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "Application", "msedge.exe"),
      process.env.USERPROFILE && path.join(process.env.USERPROFILE, "AppData", "Local", "Chromium", "Application", "chrome.exe"),
    ].filter((p): p is string => Boolean(p));
    for (const p of [...WINDOWS_CANDIDATES, ...userCandidates]) {
      if (exists(p)) {
        found = p;
        break;
      }
    }
  } else if (process.platform === "darwin") {
    for (const p of MAC_CANDIDATES) {
      if (exists(p)) {
        found = p;
        break;
      }
    }
  }

  if (!found) {
    for (const cmd of COMMANDS) {
      const p = await commandPath(cmd);
      if (p) {
        found = p;
        break;
      }
    }
  }

  probeCache = found;
  return found;
}

export async function resolveChromiumPath(): Promise<string | null> {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  if (process.env.REMOTION_BROWSER_EXECUTABLE) return process.env.REMOTION_BROWSER_EXECUTABLE;
  const found = await findSystemChromium();
  if (found) process.env.CHROME_PATH = found;
  return found;
}
