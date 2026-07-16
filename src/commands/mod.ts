import { loadConfig } from "../config";
import { getJson, patchJson, deleteJson, request, uploadCover, uploadModFile } from "../api";
import { askText, askConfirm, askSelect } from "../utils/prompts";
import { createTable, formatStatus, formatSize } from "../utils/table";
import { existsSync, readFileSync } from "fs";
import { basename } from "path";
import pc from "picocolors";
import ora from "ora";

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
        pc.cyan(mod.title),
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
    console.log("\n" + pc.bold(pc.underline(`Mod #${mod.id}: ${mod.title}`)));
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
      console.log(`${pc.bold("Tags:")}        ${mod.tags.map((t: string) => pc.blue(t)).join(", ")}`);
    }
    
    if (mod.dependencies && mod.dependencies.length > 0) {
      console.log(`${pc.bold("Dependencies:")} ${mod.dependencies.map((d: any) => `${d.title} (v${d.version}, #${d.id})`).join(", ")}`);
    }

    if (mod.description) {
      console.log(`\n${pc.bold("Description:")}\n${pc.italic(mod.description)}`);
    }

    if (mod.body) {
      console.log(`\n${pc.bold("Body (Markdown):")}`);
      console.log(pc.dim("--------------------------------------------------"));
      console.log(mod.body);
      console.log(pc.dim("--------------------------------------------------"));
    }
    console.log();
  } catch (e: any) {
    spinner.fail(`Failed to fetch mod details: ${e.message}`);
  }
}

export async function createMod(options: {
  title?: string;
  description?: string;
  body?: string;
  category?: string;
  version?: string;
  file?: string;
  cover?: string;
  tags?: string;
  dependencies?: string;
  yes?: boolean;
}) {
  await requireAuth();
  const categories = await fetchCategoryChoices();

  let title = options.title ?? "";
  let description = options.description ?? "";
  let bodyContent = resolveBody(options.body);
  let category = options.category ?? "";
  let version = options.version ?? "1.0.0";
  let filePath = options.file ?? "";
  let coverPath = options.cover ?? "";
  let tags = options.tags ?? "";
  let dependencies = options.dependencies ?? "";
  const isYes = options.yes ?? false;

  // Interactive Prompts if not supplied via flags and not running with -y/--yes
  if (!title) {
    if (isYes) {
      console.log(pc.red("Error: Title is required for non-interactive mod creation."));
      process.exit(1);
    }
    title = await askText("Mod Title:", "", (val) => (val.trim() ? true : "Title is required"));
  }
  if (options.description === undefined && !isYes) {
    description = await askText("Description (brief summary):");
  }
  if (options.body === undefined && !isYes) {
    const bodySource = await askSelect("How would you like to provide the body content (markdown)?", [
      { title: "Write here in terminal", value: "terminal" },
      { title: "Read from a local file", value: "file" },
      { title: "Leave empty", value: "empty" },
    ]);

    if (bodySource === "terminal") {
      bodyContent = await askText("Enter body content:");
    } else if (bodySource === "file") {
      const path = await askText("Enter path to markdown file:", "", (val) =>
        existsSync(val) ? true : `File not found: ${val}`
      );
      bodyContent = readFileSync(path, "utf-8");
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
  if (options.tags === undefined && !isYes) {
    tags = await askText("Tags (comma separated, e.g. weapon,tactical):");
  }
  if (options.dependencies === undefined && !isYes) {
    dependencies = await askText("Dependencies (comma separated mod IDs, e.g. 5,12):");
  }

  // Confirm creation
  if (!isYes) {
    console.log(`\n${pc.bold("Mod Upload Review:")}`);
    console.log(`Title:       ${pc.cyan(title)}`);
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

    const payload: Record<string, string | number | null> = {
      title,
      description,
      body: bodyContent,
      category,
      version,
      tags,
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
      formData.append("title", title);
      formData.append("description", description);
      formData.append("body", bodyContent);
      formData.append("category", category);
      formData.append("version", version);
      formData.append("tags", tags);
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

export async function updateMod(id: string, options: {
  title?: string;
  description?: string;
  body?: string;
  category?: string;
  version?: string;
  file?: string;
  cover?: string;
  tags?: string;
  dependencies?: string;
  yes?: boolean;
}) {
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

  let title = options.title;
  let description = options.description;
  let bodyContent = resolveBody(options.body);
  let category = options.category;
  let version = options.version;
  let filePath = options.file;
  let coverPath = options.cover;
  let tags = options.tags;
  let dependencies = options.dependencies;
  const isYes = options.yes ?? false;

  const interactive = !isYes && !Object.keys(options).some(k => ["title", "description", "body", "category", "version", "file", "cover", "tags", "dependencies"].includes(k));

  if (interactive) {
    console.log(pc.bold(`\nEditing Mod #${currentMod.id} (Leave blank to keep current value):`));
    
    title = await askText(`Title (${currentMod.title}):`) || currentMod.title;
    description = await askText(`Description (${currentMod.description || "none"}):`) || currentMod.description;
    
    const editBody = await askConfirm("Do you want to edit the body text?", false);
    if (editBody) {
      const bodySource = await askSelect("How would you like to provide the body content?", [
        { title: "Write here in terminal", value: "terminal" },
        { title: "Read from a local file", value: "file" },
      ]);
      if (bodySource === "terminal") {
        bodyContent = await askText("Enter body content:");
      } else {
        const path = await askText("Enter path to markdown file:", "", (val) =>
          existsSync(val) ? true : `File not found: ${val}`
        );
        bodyContent = readFileSync(path, "utf-8");
      }
    } else {
      bodyContent = currentMod.body;
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

    const currentTagsStr = currentMod.tags ? currentMod.tags.join(",") : "";
    tags = await askText(`Tags (${currentTagsStr || "none"}):`) || currentTagsStr;

    const currentDepsStr = currentMod.dependencies ? currentMod.dependencies.map((d: any) => d.id).join(",") : "";
    dependencies = await askText(`Dependencies (${currentDepsStr || "none"}):`) || currentDepsStr;
  }

  // Build the updates object
  const updates: any = {};
  if (title !== undefined && title !== currentMod.title) updates.title = title;
  if (description !== undefined && description !== currentMod.description) updates.description = description;
  if (bodyContent !== undefined && bodyContent !== currentMod.body) updates.body = bodyContent;
  if (category !== undefined && category !== currentMod.category) updates.category = category;
  if (version !== undefined && version !== currentMod.version) updates.version = version;
  if (tags !== undefined) {
    const nextTags = tags.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
    const currTags = currentMod.tags || [];
    if (nextTags.join(",") !== currTags.join(",")) {
      updates.tags = tags;
    }
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
