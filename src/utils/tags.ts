import type { LocalizedString } from "./localized";
import { DEFAULT_LANG } from "./localized";

function commaParts(raw: string, lang: string): LocalizedString[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 30)
    .slice(0, 10)
    .map((s) => ({ [lang]: s }));
}

export function mergeTagFieldsByLang(fields: Record<string, string>): LocalizedString[] {
  const langs = Object.keys(fields);
  const maxParts = Math.max(0, ...langs.map((l) => commaParts(fields[l] ?? "", l).length));
  const out: LocalizedString[] = [];
  for (let i = 0; i < maxParts && out.length < 10; i++) {
    const merged: LocalizedString = {};
    for (const lang of langs) {
      const parts = commaParts(fields[lang] ?? "", lang);
      const val = parts[i]?.[lang];
      if (val) merged[lang] = val;
    }
    if (Object.keys(merged).length > 0) out.push(merged);
  }
  return out;
}

export function coerceModTags(raw: unknown): LocalizedString[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => {
    if (typeof t === "string") return { [DEFAULT_LANG]: t };
    if (t && typeof t === "object") return { ...(t as LocalizedString) };
    return {};
  }).filter((t) => Object.keys(t).length > 0);
}

export function tagsEqual(a: LocalizedString[], b: LocalizedString[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}