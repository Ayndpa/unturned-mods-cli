import { join } from "path";
import { homedir } from "os";

export interface Config {
  host: string;
  token?: string;
  username?: string;
  role?: string;
  userId?: number;
}

const CONFIG_FILE = join(homedir(), ".utmod-config.json");

export async function loadConfig(): Promise<Config> {
  try {
    const file = Bun.file(CONFIG_FILE);
    if (await file.exists()) {
      return await file.json();
    }
  } catch (e) {
    // Ignore error
  }
  return { host: "http://localhost:3000" };
}

export async function saveConfig(config: Config): Promise<void> {
  await Bun.write(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export async function clearConfig(): Promise<void> {
  const config = await loadConfig();
  delete config.token;
  delete config.username;
  delete config.role;
  delete config.userId;
  await saveConfig(config);
}
