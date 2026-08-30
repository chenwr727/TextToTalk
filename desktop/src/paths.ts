import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

export const repoRoot = path.resolve(__dirname, "..", "..");

export function serverDir(): string {
  return app.isPackaged ? path.join(process.resourcesPath, "server") : path.join(repoRoot, "server");
}

export function webDistDir(): string {
  return app.isPackaged ? path.join(process.resourcesPath, "web") : path.join(repoRoot, "web", "dist");
}

export function binDir(): string {
  if (app.isPackaged) return path.join(process.resourcesPath, "bin");
  return path.join(repoRoot, "desktop", "node_modules", "ffmpeg-static");
}

export function userDataDir(): string {
  return app.getPath("userData");
}

export function runtimeDataDir(): string {
  return app.isPackaged ? path.join(userDataDir(), "data") : path.join(serverDir());
}

let portableRoot: string | null = null;

export function isPortable(): boolean {
  return portableRoot !== null;
}

function dirWritable(dir: string): boolean {
  const probe = path.join(dir, `.ttt-write-test-${process.pid}`);
  try {
    fs.writeFileSync(probe, "1");
    fs.rmSync(probe, { force: true });
    return true;
  } catch {
    return false;
  }
}

export function setupPortableMode(): void {
  if (!app.isPackaged) return;
  try {
    const exeDir = path.dirname(app.getPath("exe"));
    if (!fs.existsSync(path.join(exeDir, "portable.txt"))) return;
    if (!dirWritable(exeDir)) {
      console.warn(`[desktop] 检测到 portable.txt 但应用目录不可写，回退到 %APPDATA%：${exeDir}`);
      return;
    }
    const target = path.join(exeDir, "UserData");
    fs.mkdirSync(target, { recursive: true });
    app.setPath("userData", target);
    portableRoot = exeDir;
    console.log(`[desktop] 免安装模式已启用，数据目录：${target}`);
  } catch (e) {
    console.warn("[desktop] 免安装模式检测失败，使用默认数据目录：", e);
  }
}

export function windowIcon(): string | undefined {
  const ext = process.platform === "win32" ? "icon.ico" : "icon.png";
  const file = path.join(__dirname, "..", "build", ext);
  return fs.existsSync(file) ? file : undefined;
}
