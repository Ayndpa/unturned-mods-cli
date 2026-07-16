export type LocalizedString = Record<string, string>;
export const DEFAULT_LANG = "zh";

export function pickLocalized(
  field: LocalizedString | string | null | undefined,
  locale = DEFAULT_LANG,
): string {
  if (!field) return "";
  if (typeof field === "string") return field;
  const v = field[locale];
  if (v?.trim()) return v;
  const fb = field[DEFAULT_LANG];
  if (fb?.trim()) return fb;
  for (const val of Object.values(field)) {
    if (val?.trim()) return val;
  }
  return "";
}

export function toLocalizedMap(v: LocalizedString | string | null | undefined): LocalizedString {
  if (!v) return {};
  if (typeof v === "string") return { [DEFAULT_LANG]: v };
  return { ...v };
}

export function buildLocalized(
  legacy: string | undefined,
  perLang: Record<string, string | undefined>,
  resolve: (v: string) => string = (v) => v,
): LocalizedString {
  const map: LocalizedString = {};
  for (const [lang, val] of Object.entries(perLang)) {
    if (val !== undefined) {
      const t = resolve(val).trim();
      if (t) map[lang] = t;
    }
  }
  if (legacy !== undefined && Object.keys(map).length === 0) {
    const t = resolve(legacy).trim();
    if (t) map[DEFAULT_LANG] = t;
  }
  return map;
}

export function trimMap(m: LocalizedString): LocalizedString {
  const out: LocalizedString = {};
  for (const [k, v] of Object.entries(m)) {
    if (v.trim()) out[k] = v.trim();
  }
  return out;
}

export function appendLocalizedFormData(fd: FormData, prefix: string, map: LocalizedString) {
  for (const [lang, val] of Object.entries(map)) {
    fd.append(`${prefix}_${lang}`, val);
  }
}

export function mergeLocalized(current: LocalizedString, patch: LocalizedString): LocalizedString {
  return { ...current, ...patch };
}

export function localizedEqual(a: LocalizedString, b: LocalizedString): boolean {
  return JSON.stringify(trimMap(a)) === JSON.stringify(trimMap(b));
}