import { contextBridge, ipcRenderer } from "electron";
import type { AppConfig } from "./config";


export interface RuntimeInfo {
  packaged: boolean;
  portable: boolean;
  version: string;
  baseUrl: string;
  userData: string;
  serverDir: string;
  outDir: string;
  dataDir: string;
  binDir: string;
  deps: { chrome: string | null; ffmpeg: string | null };
}

const api = {
  getRuntime: (): Promise<RuntimeInfo> => ipcRenderer.invoke("ttt:get-runtime"),
  getConfig: (): Promise<{ config: AppConfig; llm: { baseUrl: string; model: string; configured: boolean } | null }> =>
    ipcRenderer.invoke("ttt:get-config"),
  saveConfig: (cfg: Partial<AppConfig>): Promise<{ ok: boolean; baseUrl?: string; error?: string }> =>
    ipcRenderer.invoke("ttt:save-config", cfg),
  openOutputDir: (): Promise<string | null> => ipcRenderer.invoke("ttt:open-output-dir"),
  openDataDir: (): Promise<string | null> => ipcRenderer.invoke("ttt:open-data-dir"),
  restart: (): Promise<{ ok: boolean; baseUrl?: string; error?: string }> => ipcRenderer.invoke("ttt:restart"),
  closeSelf: () => ipcRenderer.invoke("ttt:close-self"),
};

contextBridge.exposeInMainWorld("ttt", api);

export type TttApi = typeof api;
