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

// Perform an authenticated PUT (used for internal /api/upload/direct/* targets,
// which are auth-protected). External presigned URLs are PUT without credentials.
async function putUpload(target: string, body: Blob | ArrayBuffer | File, contentType: string): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": contentType };
  if (target.startsWith("/")) {
    const config = await loadConfig();
    target = `${config.host}${target}`;
    if (config.token) headers["Cookie"] = `token=${config.token}`;
  }
  return await fetch(target, { method: "PUT", headers, body });
}

// Upload a cover image (returns public URL). Uses the presign flow for production
// and falls back to the multipart /api/upload/cover endpoint used by local dev.
export async function uploadCover(filePath: string): Promise<string> {
  if (!existsSync(filePath)) {
    throw new Error(`Cover file not found: ${filePath}`);
  }

  const file = Bun.file(filePath);
  const filename = basename(filePath);
  const contentType = file.type || "image/png";
  const size = file.size;

  // 1. Presign flow (production).
  try {
    const presignRes = await request("/api/upload/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "cover", filename, contentType, size }),
    });
    const presign = await presignRes.json().catch(() => null) as
      | { uploadUrl?: string; publicUrl?: string } | null;
    if (presign?.uploadUrl && presign?.publicUrl) {
      const putRes = await putUpload(presign.uploadUrl, file, contentType);
      if (putRes.ok) {
        return presign.publicUrl;
      }
    }
  } catch {
    // Fall through to multipart.
  }

  // 2. Multipart fallback (local dev).
  const formData = new FormData();
  formData.append("cover", file, filename);

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

// Upload a mod package via the presign flow used by the production (Cloudflare
// Worker / R2) deployment. Returns the public URL + size. Throws if it fails.
async function uploadModPackagePresigned(filePath: string, filename: string, size: number): Promise<{ url: string; size: number }> {
  const file = Bun.file(filePath);
  const contentType = file.type || "application/octet-stream";

  // 1. Ask the server for a presigned upload target.
  const presignRes = await request("/api/upload/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: "mod",
      filename,
      contentType,
      size,
    }),
  });

  const presign = await presignRes.json().catch(() => null) as
    | { uploadUrl?: string; publicUrl?: string; key?: string } | null;
  if (!presign?.uploadUrl || !presign?.publicUrl) {
    throw new Error("Invalid response from /api/upload/presign");
  }

  // 2. PUT the file to the upload target. The target may be an API-relative path
  //    (worker BUCKET binding -> /api/upload/direct/...) or an R2 presigned URL.
  const putRes = await putUpload(presign.uploadUrl, file, contentType);

  if (!putRes.ok) {
    const text = await putRes.text().catch(() => "");
    let msg = `Upload PUT failed (HTTP ${putRes.status})`;
    try { msg = JSON.parse(text).error || msg; } catch { /* keep msg */ }
    throw new Error(msg);
  }

  return { url: presign.publicUrl, size };
}

// Upload a mod package (returns file url and size).
// Uses the presign flow for production/remote hosts and falls back to the
// multipart /api/upload/mod-file endpoint used by local dev deployments.
export async function uploadModFile(filePath: string): Promise<{ url: string; size: number }> {
  if (!existsSync(filePath)) {
    throw new Error(`Mod file not found: ${filePath}`);
  }

  const file = Bun.file(filePath);
  const filename = basename(filePath);
  const size = file.size;

  // Prefer the presign flow (production). If the endpoint is unavailable
  // (local dev returns 404 / errors), fall back to multipart mod-file upload.
  try {
    return await uploadModPackagePresigned(filePath, filename, size);
  } catch (e: any) {
    // Fall through to multipart flow.
  }

  const formData = new FormData();
  formData.append("mod_file", file, filename);

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
