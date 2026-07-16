import { loadConfig } from "../config";
import { getJson, patchJson, deleteJson, request, uploadCover, uploadModFile } from "../api";
import { askText, askConfirm, askSelect } from "../utils/prompts";
import { createTable, formatStatus, formatSize } from "../utils/table";
import { existsSync, readFileSync } from "fs";
import { basename } from "path";
import pc from "picocolors";
import ora from "ora";
import {
  appendLocalizedFormData,
  buildLocalized,
  localizedEqual,
  mergeLocalized,
  pickLocalized,
  toLocalizedMap,
  trimMap,
  type LocalizedString,
} from "../utils/localized";
import {
  coerceModTags,
  mergeTagFieldsByLang,
  tagsEqual,
} from "../utils/tags";

// Resolve a --body flag value: if it points to an existing file, read its contents;
// otherwise treat the value as literal markdown content.
function resolveBody(value: string | undefined): string {
  if (!value) return "";
  if (existsSync(value) && !value.includes("\n")) {
    return readFileSync(value, "utf-8");
  }
  return value;
}

// Check authentication status and exit if not authenticated
async function requireAuth() {
  const config = await loadConfig();
  if (!config.token || !config.userId) {
    console.log(pc.red("Error: You must be logged in to run this command."));
    console.log(`Run ${pc.bold("utmod auth login")} to log in.`);
    process.exit(1);
  }
  return config;
}

// Fetch categories for selection
async function fetchCategoryChoices() {
  try {
    const data = await getJson("/api/categories");
    if (data && data.categories) {
      return data.categories.map((c: any) => ({
        title: `${c.name_zh} / ${c.name_en} (${c.key})`,
        value: c.key,
      }));
    }
  } catch (e) {
    // Fallback to defaults
  }
  return [
    { title: "武器 / Weapon (weapon)", value: "weapon" },
    { title: "地图 / Map (map)", value: "map" },
    { title: "载具 / Vehicle (vehicle)", value: "vehicle" },
    { title: "生存 / Survival (survival)", value: "survival" },
    { title: "界面 / UI (ui)", value: "ui" },
    { title: "其他 / Other (other)", value: "other" },
  ];
}

export async function listMods() {
  const config = await requireAuth();
  const spinner = ora("Fetching your mods...").start();

  try {
    const data = await getJson(`/api/mods/user/${config.userId}/all`);
    spinner.stop();

    if (!data || !data.mods || data.mods.length === 0) {
      console.log(pc.yellow("\nYou haven't uploaded any mods yet."));
      console.log(`Run ${pc.bold("utmod mod create")} to upload your first mod!\n`);
      return;
    }

    const table = createTable(["ID", "Title", "Category", "Version", "Status", "Downloads", "Likes"]);
    for (const mod of data.mods) {
      table.push([
        mod.id,
        pc.cyan(pickLocalized(mod.title)),
        mod.category,
        mod.version,
        formatStatus(mod.status, mod.reject_reason),
        mod.downloads ?? 0,
        mod.like_count ?? 0,
      ]);
    }

    console.log("\n" + pc.bold("Your Uploaded Mods:"));
    console.log(table.toString());
    console.log(`Total: ${data.mods.length} mod(s)\n`);
  } catch (e: any) {
    spinner.fail(`Failed to fetch mods: ${e.message}`);
  }
}

export async function viewMod(id: string) {
  const modId = parseInt(id, 10);
  if (isNaN(modId)) {
    console.log(pc.red("Error: Mod ID must be a number."));
    process.exit(1);
  }

  const spinner = ora(`Fetching details for mod #${modId}...`).start();

  try {
    const data = await getJson(`/api/mods/${modId}`);
    spinner.stop();

    if (!data || !data.mod) {
      console.log(pc.red(`Error: Mod #${modId} not found.`));
      return;
    }

    const mod = data.mod;
    const titleLine = pickLocalized(mod.title);
    console.log("\n" + pc.bold(pc.underline(`Mod #${mod.id}: ${titleLine}`)));
    if (typeof mod.title === "object" && mod.title) {
      for (const [lang, val] of Object.entries(mod.title)) {
        if (val?.trim()) console.log(`  ${pc.dim(`Title (${lang}):`)} ${val}`);
      }
    }
    console.log(`${pc.bold("Author:")}      ${mod.author_name}`);
    console.log(`${pc.bold("Category:")}    ${mod.category}`);
    console.log(`${pc.bold("Version:")}     ${mod.version}`);
    console.log(`${pc.bold("Status:")}      ${formatStatus(mod.status, mod.reject_reason)}`);
    console.log(`${pc.bold("File Size:")}   ${mod.has_file ? formatSize(mod.file_size) : pc.yellow("No File Uploaded")}`);
    console.log(`${pc.bold("Downloads:")}   ${mod.downloads ?? 0}`);
    console.log(`${pc.bold("Likes:")}       ${mod.like_count ?? 0}`);
    console.log(`${pc.bold("Created:")}     ${new Date(mod.created_at * 1000).toLocaleString()}`);
    console.log(`${pc.bold("Updated:")}     ${new Date(mod.updated_at * 1000).toLocaleString()}`);
    
    if (mod.tags && mod.tags.length > 0) {
      const tagLine = coerceModTags(mod.tags)
        .map((t) => pickLocalized(t))
        .join(", ");
      console.log(`${pc.bold("Tags:")}        ${tagLine.split(", ").map((s) => pc.blue(s)).join(", ")}`);
    }
    
    if (mod.dependencies && mod.dependencies.length > 0) {
      console.log(`${pc.bold("Dependencies:")} ${mod.dependencies.map((d: any) => `${pickLocalized(d.title)} (v${d.version}, #${d.id})`).join(", ")}`);
    }

    const descText = pickLocalized(mod.description);
    if (descText) {
      console.log(`\n${pc.bold("Description:")}\n${pc.italic(descText)}`);
    }

    const bodyText = pickLocalized(mod.body);
    if (bodyText) {
      console.log(`\n${pc.bold("Body (Markdown):")}`);
      console.log(pc.dim("--------------------------------------------------"));
      console.log(bodyText);
      console.log(pc.dim("--------------------------------------------------"));
    }
    console.log();
  } catch (e: any) {
    spinner.fail(`Failed to fetch mod details: ${e.message}`);
  }
}

type LocalizedCreateOptions = {
  title?: string;
  titleZh?: string;
  titleEn?: string;
  description?: string;
  descZh?: string;
  descEn?: string;
  body?: string;
  bodyZh?: string;
  bodyEn?: string;
  category?: string;
  version?: string;
  file?: string;
  cover?: string;
  tags?: string;
  tagsZh?: string;
  tagsEn?: string;
  tagsJson?: string;
  dependencies?: string;
  yes?: boolean;
};

function buildTagsFromOptions(options: LocalizedCreateOptions): LocalizedString[] | undefined {
  if (options.tagsJson) {
    if (!existsSync(options.tagsJson)) {
      console.log(pc.red(`Error: tags JSON file not found: ${options.tagsJson}`));
      process.exit(1);
    }
    const parsed = JSON.parse(readFileSync(options.tagsJson, "utf-8"));
    return coerceModTags(parsed);
  }
  const fields: Record<string, string> = {};
  if (options.tagsZh !== undefined) fields.zh = options.tagsZh;
  if (options.tagsEn !== undefined) fields.en = options.tagsEn;
  if (options.tags !== undefined && Object.keys(fields).length === 0) fields.zh = options.tags;
  if (Object.keys(fields).length === 0) return undefined;
  return mergeTagFieldsByLang(fields);
}

export async function createMod(options: LocalizedCreateOptions) {
  await requireAuth();
  const categories = await fetchCategoryChoices();

  let titleMap = buildLocalized(options.title, {
    zh: options.titleZh,
    en: options.titleEn,
  });
  let descMap = buildLocalized(options.description, {
    zh: options.descZh,
    en: options.descEn,
  });
  let bodyMap = buildLocalized(options.body, {
    zh: options.bodyZh,
    en: options.bodyEn,
  }, resolveBody);
  let category = options.category ?? "";
  let version = options.version ?? "1.0.0";
  let filePath = options.file ?? "";
  let coverPath = options.cover ?? "";
  const tagsFromOpts = buildTagsFromOptions(options);
  let tagsList: LocalizedString[] = tagsFromOpts ?? [];
  let dependencies = options.dependencies ?? "";
  const isYes = options.yes ?? false;

  // Interactive Prompts if not supplied via flags and not running with -y/--yes
  if (Object.keys(titleMap).length === 0) {
    if (isYes) {
      console.log(pc.red("Error: Title is required for non-interactive mod creation."));
      process.exit(1);
    }
    const t = await askText("Mod Title (zh):", "", (val) => (val.trim() ? true : "Title is required"));
    titleMap = { zh: t.trim() };
  }
  if (!options.description && !options.descZh && !options.descEn && !isYes) {
    const d = await askText("Description (brief summary, zh):");
    if (d.trim()) descMap = { zh: d.trim() };
  }
  if (!options.body && !options.bodyZh && !options.bodyEn && !isYes) {
    const bodySource = await askSelect("How would you like to provide the body content (markdown)?", [
      { title: "Write here in terminal", value: "terminal" },
      { title: "Read from a local file", value: "file" },
      { title: "Leave empty", value: "empty" },
    ]);

    if (bodySource === "terminal") {
      const b = await askText("Enter body content:");
      if (b.trim()) bodyMap = { zh: b.trim() };
    } else if (bodySource === "file") {
      const path = await askText("Enter path to markdown file:", "", (val) =>
        existsSync(val) ? true : `File not found: ${val}`
      );
      bodyMap = { zh: readFileSync(path, "utf-8").trim() };
    }
  }
  if (!category) {
    if (isYes) {
      category = "other"; // Default fallback
    } else {
      category = await askSelect("Select Category:", categories);
    }
  }
  if (options.version === undefined && !isYes) {
    version = await askText("Version:", "1.0.0");
  }
  if (!filePath) {
    if (isYes) {
      console.log(pc.red("Error: File path is required for non-interactive mod creation."));
      process.exit(1);
    }
    filePath = await askText("Path to Mod ZIP file:", "", (val) =>
      existsSync(val) ? true : `File not found: ${val}`
    );
  }
  if (options.cover === undefined && !isYes) {
    const hasCover = await askConfirm("Do you want to upload a cover image?", false);
    if (hasCover) {
      coverPath = await askText("Path to Cover Image:", "", (val) =>
        existsSync(val) ? true : `File not found: ${val}`
      );
    }
  }
  if (options.tags === undefined && options.tagsZh === undefined && options.tagsEn === undefined && !isYes) {
    const tZh = await askText("Tags (zh, comma separated):");
    const tEn = await askText("Tags (en, comma separated, optional):");
    tagsList = mergeTagFieldsByLang({
      ...(tZh.trim() ? { zh: tZh } : {}),
      ...(tEn.trim() ? { en: tEn } : {}),
    });
  }
  if (options.dependencies === undefined && !isYes) {
    dependencies = await askText("Dependencies (comma separated mod IDs, e.g. 5,12):");
  }

  const cleanTitle = trimMap(titleMap);
  const cleanDesc = trimMap(descMap);
  const cleanBody = trimMap(bodyMap);
  if (Object.values(cleanTitle).every(v => !v)) {
    console.log(pc.red("Error: Title is required in at least one language."));
    process.exit(1);
  }

  // Confirm creation
  if (!isYes) {
    console.log(`\n${pc.bold("Mod Upload Review:")}`);
    console.log(`Title:       ${pc.cyan(JSON.stringify(cleanTitle))}`);
    console.log(`Category:    ${pc.cyan(category)}`);
    console.log(`Version:     ${pc.cyan(version)}`);
    console.log(`Mod File:    ${pc.cyan(filePath)}`);
    if (coverPath) console.log(`Cover Image: ${pc.cyan(coverPath)}`);
    
    const proceed = await askConfirm("\nDo you want to proceed with uploading this mod?", true);
    if (!proceed) {
      console.log("Upload cancelled.");
      return;
    }
  }

  const spinner = ora("Preparing upload...").start();

  try {
    // 1. Upload cover image (if any) -> public URL.
    let coverUrl: string | null = null;
    if (coverPath) {
      spinner.text = `Uploading cover image: ${basename(coverPath)}...`;
      coverUrl = await uploadCover(coverPath);
    }

    // 2. Upload the mod package -> { url, size }. (Handles both presign/remote
    //    and multipart/local flows internally.)
    spinner.text = `Uploading mod file: ${basename(filePath)}...`;
    const { url: fileUrl, size: fileSize } = await uploadModFile(filePath);

    // 3. Create the mod entry. Production (/api/upload/mod via Cloudflare Worker)
    //    expects JSON with file_url + file_size; local dev expects multipart form.
    //    Try JSON first (production), fall back to multipart (local dev).
    spinner.text = "Creating mod entry...";

    const payload: Record<string, unknown> = {
      title: cleanTitle,
      description: Object.keys(cleanDesc).length ? cleanDesc : undefined,
      body: Object.keys(cleanBody).length ? cleanBody : undefined,
      category,
      version,
      tags: tagsList.length ? tagsList : undefined,
      dependencies,
      cover_url: coverUrl,
      file_url: fileUrl,
      file_size: fileSize,
    };

    let data: any = null;
    try {
      const res = await request("/api/upload/mod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      data = await res.json();
    } catch (jsonErr: any) {
      // JSON path rejected (local dev only accepts multipart) -> fall back.
      const formData = new FormData();
      appendLocalizedFormData(formData, "title", cleanTitle);
      appendLocalizedFormData(formData, "description", cleanDesc);
      appendLocalizedFormData(formData, "body", cleanBody);
      formData.append("category", category);
      formData.append("version", version);
      if (tagsList.length) formData.append("tags", JSON.stringify(tagsList));
      formData.append("dependencies", dependencies);
      if (coverUrl) formData.append("cover_url", coverUrl);
      formData.append("mod_file", Bun.file(filePath), basename(filePath));

      const res = await request("/api/upload/mod", { method: "POST", body: formData });
      data = await res.json();
    }

    if (data?.ok && data?.mod_id) {
      spinner.succeed(`Mod created successfully! Mod ID: ${pc.green(data.mod_id)}`);
      console.log(`Your mod is now ${pc.yellow("Pending Approval")} by moderators.`);
    } else {
      throw new Error(data?.error || "Unknown server error");
    }
  } catch (e: any) {
    spinner.fail(`Failed to create mod: ${e.message}`);
  }
}

export async function updateMod(id: string, options: LocalizedCreateOptions) {
  await requireAuth();
  const modId = parseInt(id, 10);
  if (isNaN(modId)) {
    console.log(pc.red("Error: Mod ID must be a number."));
    process.exit(1);
  }

  const fetchSpinner = ora(`Fetching current details for mod #${modId}...`).start();
  let currentMod: any;
  try {
    const data = await getJson(`/api/mods/${modId}`);
    fetchSpinner.stop();
    if (!data || !data.mod) {
      console.log(pc.red(`Error: Mod #${modId} not found.`));
      process.exit(1);
    }
    currentMod = data.mod;
  } catch (e: any) {
    fetchSpinner.fail(`Failed to fetch current mod details: ${e.message}`);
    process.exit(1);
  }

  const categories = await fetchCategoryChoices();

  const currentTitleMap = toLocalizedMap(currentMod.title);
  const currentDescMap = toLocalizedMap(currentMod.description);
  const currentBodyMap = toLocalizedMap(currentMod.body);

  const titlePatch = buildLocalized(options.title, { zh: options.titleZh, en: options.titleEn });
  const descPatch = buildLocalized(options.description, { zh: options.descZh, en: options.descEn });
  const bodyPatch = buildLocalized(options.body, { zh: options.bodyZh, en: options.bodyEn }, resolveBody);

  let category = options.category;
  let version = options.version;
  let filePath = options.file;
  let coverPath = options.cover;
  let tagsPatch: LocalizedString[] | undefined = buildTagsFromOptions(options);
  let dependencies = options.dependencies;
  const isYes = options.yes ?? false;

  const interactive = !isYes && !Object.keys(options).some(k =>
    ["title", "description", "body", "category", "version", "file", "cover", "tags", "tagsZh", "tagsEn", "tagsJson", "dependencies"].includes(k));

  let descPatchMerged = { ...currentDescMap };
  let bodyPatchMerged = { ...currentBodyMap };

  if (interactive) {
    console.log(pc.bold(`\nEditing Mod #${currentMod.id} (Leave blank to keep current value):`));

    const tZh = await askText(`Title zh (${pickLocalized(currentMod.title, "zh") || "none"}):`);
    if (tZh.trim()) titlePatch.zh = tZh.trim();
    const d = await askText(`Description zh (${pickLocalized(currentMod.description, "zh") || "none"}):`);
    if (d.trim()) descPatchMerged.zh = d.trim();

    const editBody = await askConfirm("Do you want to edit the body text?", false);
    if (editBody) {
      const bodySource = await askSelect("How would you like to provide the body content?", [
        { title: "Write here in terminal", value: "terminal" },
        { title: "Read from a local file", value: "file" },
      ]);
      if (bodySource === "terminal") {
        const b = await askText("Enter body content:");
        if (b.trim()) bodyPatchMerged = { zh: b.trim() };
      } else {
        const path = await askText("Enter path to markdown file:", "", (val) =>
          existsSync(val) ? true : `File not found: ${val}`
        );
        bodyPatchMerged = { zh: readFileSync(path, "utf-8").trim() };
      }
    }

    const editCat = await askConfirm(`Change category from "${currentMod.category}"?`, false);
    if (editCat) {
      category = await askSelect("Select Category:", categories);
    } else {
      category = currentMod.category;
    }

    version = await askText(`Version (${currentMod.version}):`) || currentMod.version;

    const changeFile = await askConfirm("Do you want to upload a new mod ZIP file?", false);
    if (changeFile) {
      filePath = await askText("Path to new Mod ZIP file:", "", (val) =>
        existsSync(val) ? true : `File not found: ${val}`
      );
    }

    const changeCover = await askConfirm("Do you want to upload a new cover image?", false);
    if (changeCover) {
      coverPath = await askText("Path to new Cover Image:", "", (val) =>
        existsSync(val) ? true : `File not found: ${val}`
      );
    }

    const currTags = coerceModTags(currentMod.tags);
    const tagsZhInput = await askText(`Tags zh (${currTags.map(t => pickLocalized(t, "zh")).filter(Boolean).join(", ") || "none"}):`);
    const tagsEnInput = await askText(`Tags en (${currTags.map(t => pickLocalized(t, "en")).filter(Boolean).join(", ") || "none"}):`);
    if (tagsZhInput.trim() || tagsEnInput.trim()) {
      tagsPatch = mergeTagFieldsByLang({
        ...(tagsZhInput.trim() ? { zh: tagsZhInput } : {}),
        ...(tagsEnInput.trim() ? { en: tagsEnInput } : {}),
      });
    }

    const currentDepsStr = currentMod.dependencies ? currentMod.dependencies.map((d: any) => d.id).join(",") : "";
    dependencies = await askText(`Dependencies (${currentDepsStr || "none"}):`) || currentDepsStr;
  } else {
    // Non-interactive (-y): apply CLI language patches (interactive path merges via prompts).
    descPatchMerged = mergeLocalized(currentDescMap, descPatch);
    bodyPatchMerged = mergeLocalized(currentBodyMap, bodyPatch);
  }

  const nextTitle = mergeLocalized(currentTitleMap, titlePatch);
  const nextDesc = mergeLocalized(currentDescMap, descPatchMerged);
  const nextBody = mergeLocalized(currentBodyMap, bodyPatchMerged);

  const hasTitlePatch =
    options.title !== undefined || options.titleZh !== undefined || options.titleEn !== undefined;
  const hasDescPatch =
    options.description !== undefined || options.descZh !== undefined || options.descEn !== undefined;
  const hasBodyPatch =
    options.body !== undefined || options.bodyZh !== undefined || options.bodyEn !== undefined;

  // Build the updates object
  const updates: any = {};
  if (hasTitlePatch && !localizedEqual(nextTitle, currentTitleMap)) updates.title = nextTitle;
  if (hasDescPatch && !localizedEqual(nextDesc, currentDescMap)) {
    updates.description = Object.keys(trimMap(nextDesc)).length ? trimMap(nextDesc) : {};
  }
  if (hasBodyPatch && !localizedEqual(nextBody, currentBodyMap)) {
    updates.body = Object.keys(trimMap(nextBody)).length ? trimMap(nextBody) : {};
  }
  if (category !== undefined && category !== currentMod.category) updates.category = category;
  if (version !== undefined && version !== currentMod.version) updates.version = version;
  const hasTagsPatch =
    options.tags !== undefined || options.tagsZh !== undefined ||
    options.tagsEn !== undefined || options.tagsJson !== undefined;
  if (hasTagsPatch && tagsPatch !== undefined) {
    const currTags = coerceModTags(currentMod.tags);
    if (!tagsEqual(tagsPatch, currTags)) updates.tags = tagsPatch;
  }
  if (dependencies !== undefined) {
    const nextDeps = dependencies.split(",").map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d));
    const currDeps = currentMod.dependencies ? currentMod.dependencies.map((d: any) => d.id) : [];
    if (nextDeps.join(",") !== currDeps.join(",")) {
      updates.dependencies = dependencies;
    }
  }

  // Check if we actually have anything to update
  if (Object.keys(updates).length === 0 && !filePath && !coverPath) {
    console.log(pc.yellow("\nNo changes detected. Mod update aborted."));
    return;
  }

  if (!isYes) {
    // Review changes
    console.log(`\n${pc.bold("Pending Updates for Mod #" + modId + ":")}`);
    Object.entries(updates).forEach(([key, val]) => {
      console.log(`  ${pc.bold(key)}: ${pc.cyan(String(val))}`);
    });
    if (filePath) console.log(`  ${pc.bold("Mod File ZIP")}: ${pc.cyan(filePath)} (will be uploaded)`);
    if (coverPath) console.log(`  ${pc.bold("Cover Image")}: ${pc.cyan(coverPath)} (will be uploaded)`);

    const proceed = await askConfirm("\nProceed with updating this mod?", true);
    if (!proceed) {
      console.log("Update cancelled.");
      return;
    }
  }

  const spinner = ora("Updating mod...").start();

  try {
    // 1. Upload cover if changed
    if (coverPath) {
      spinner.text = `Uploading cover image: ${basename(coverPath)}...`;
      const coverUrl = await uploadCover(coverPath);
      updates.cover_url = coverUrl;
    }

    // 2. Upload zip if changed
    if (filePath) {
      spinner.text = `Uploading new mod file: ${basename(filePath)}...`;
      const { url, size } = await uploadModFile(filePath);
      updates.file_url = url;
      updates.file_size = size;
    }

    // 3. Patch mod details
    spinner.text = "Saving metadata updates...";
    const data = await patchJson(`/api/mods/${modId}`, updates);

    if (data?.ok) {
      spinner.succeed(`Mod #${modId} updated successfully!`);
      console.log(`The mod is now ${pc.yellow("Pending Re-approval")} by moderators.`);
    } else {
      throw new Error(data?.error || "Unknown server error");
    }
  } catch (e: any) {
    spinner.fail(`Failed to update mod: ${e.message}`);
  }
}

export async function deleteMod(id: string) {
  await requireAuth();
  const modId = parseInt(id, 10);
  if (isNaN(modId)) {
    console.log(pc.red("Error: Mod ID must be a number."));
    process.exit(1);
  }

  const fetchSpinner = ora(`Checking mod #${modId}...`).start();
  let modTitle = "";
  try {
    const data = await getJson(`/api/mods/${modId}`);
    fetchSpinner.stop();
    if (!data || !data.mod) {
      console.log(pc.red(`Error: Mod #${modId} not found.`));
      process.exit(1);
    }
    modTitle = data.mod.title;
  } catch (e: any) {
    fetchSpinner.fail(`Failed to check mod details: ${e.message}`);
    process.exit(1);
  }

  const proceed = await askConfirm(
    `Are you sure you want to ${pc.red("DELETE")} mod "${pc.cyan(modTitle)}" (ID #${modId})?\nThis action is permanent and cannot be undone!`,
    false
  );
  if (!proceed) {
    console.log("Deletion cancelled.");
    return;
  }

  const spinner = ora(`Deleting mod #${modId}...`).start();
  try {
    const data = await deleteJson(`/api/mods/${modId}`);
    if (data?.ok) {
      spinner.succeed(`Mod "${modTitle}" (ID #${modId}) deleted successfully.`);
    } else {
      throw new Error(data?.error || "Unknown server error");
    }
  } catch (e: any) {
    spinner.fail(`Failed to delete mod: ${e.message}`);
  }
}
