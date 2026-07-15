import { loadConfig } from "./config";
import { existsSync } from "fs";
import { basename } from "path";

export async function request(path: string, options: RequestInit = {}) {
  const config = await loadConfig();
  const url = `${config.host}${path}`;

  const headers = new Headers(options.headers || {});
  
  // Set Cookie for session authentication
  if (config.token) {
    headers.set("Cookie", `token=${config.token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    throw new Error("Unauthorized: Please log in using `utmod auth login` first.");
  }

  if (!res.ok) {
    const text = await res.text();
    let errorMsg = `HTTP Error ${res.status}`;
    try {
      const json = JSON.parse(text);
      errorMsg = json.error || errorMsg;
    } catch {
      // Not JSON
    }
    throw new Error(errorMsg);
  }

  return res;
}

export async function getJson<T = any>(path: string): Promise<T> {
  const res = await request(path, { method: "GET" });
  return await res.json() as T;
}

export async function postJson<T = any>(path: string, body: any): Promise<T> {
  const res = await request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return await res.json() as T;
}

export async function patchJson<T = any>(path: string, body: any): Promise<T> {
  const res = await request(path, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return await res.json() as T;
}

export async function deleteJson<T = any>(path: string): Promise<T> {
  const res = await request(path, { method: "DELETE" });
  return await res.json() as T;
}

// Upload a cover image
export async function uploadCover(filePath: string): Promise<string> {
  if (!existsSync(filePath)) {
    throw new Error(`Cover file not found: ${filePath}`);
  }

  const file = Bun.file(filePath);
  const formData = new FormData();
  formData.append("cover", file, basename(filePath));

  const res = await request("/api/upload/cover", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (!data?.url) {
    throw new Error("Invalid response from cover upload: URL missing");
  }
  return data.url;
}

// Upload a mod package (returns file url and size)
export async function uploadModFile(filePath: string): Promise<{ url: string; size: number }> {
  if (!existsSync(filePath)) {
    throw new Error(`Mod file not found: ${filePath}`);
  }

  const file = Bun.file(filePath);
  const formData = new FormData();
  formData.append("mod_file", file, basename(filePath));

  const res = await request("/api/upload/mod-file", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (!data?.url || !data?.size) {
    throw new Error("Invalid response from mod file upload");
  }
  return { url: data.url, size: data.size };
}
