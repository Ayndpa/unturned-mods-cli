#!/usr/bin/env bun
import { Command } from "commander";
import { login, logout, status } from "./commands/auth";
import { listMods, viewMod, createMod, updateMod, deleteMod } from "./commands/mod";
import pkg from "../package.json";

const program = new Command();

program
  .name("utmod")
  .description("CLI tool to manage your mods on Unturned Mods Hub")
  .version(pkg.version, "-V, --program-version");

// Auth group
const auth = program.command("auth").description("Authenticate with Unturned Mods Hub");

auth
  .command("login")
  .description("Log in to the Unturned Mods Hub via web browser")
  .option("--host <url>", "Specify the server host URL")
  .action(login);

auth
  .command("logout")
  .description("Log out and clear local credentials")
  .action(logout);

auth
  .command("status")
  .description("Display authentication status")
  .action(status);

// Mod group
const mod = program.command("mod").description("Manage your mods");

mod
  .command("list")
  .description("List all your uploaded mods")
  .action(listMods);

mod
  .command("view <id>")
  .description("View details of a specific mod")
  .action(viewMod);

mod
  .command("create")
  .description("Upload and create a new mod")
  .option("--title <title>", "Title of the mod")
  .option("--description <desc>", "Brief description")
  .option("--body <body>", "Markdown content or path to a markdown file")
  .option("--category <category>", "Mod category key")
  .option("--version <version>", "Initial version")
  .option("--file <zipPath>", "Path to mod ZIP file")
  .option("--cover <coverPath>", "Path to cover image")
  .option("--tags <tags>", "Comma separated tags")
  .option("--dependencies <ids>", "Comma separated dependency mod IDs")
  .option("-y, --yes", "Skip interactive prompts and confirmation")
  .action(createMod);

mod
  .command("update <id>")
  .description("Update details of an existing mod")
  .option("--title <title>", "New title of the mod")
  .option("--description <desc>", "New brief description")
  .option("--body <body>", "New markdown content or path to a markdown file")
  .option("--category <category>", "New mod category key")
  .option("--version <version>", "New version string")
  .option("--file <zipPath>", "Path to new mod ZIP file")
  .option("--cover <coverPath>", "Path to new cover image")
  .option("--tags <tags>", "New tags (comma separated)")
  .option("--dependencies <ids>", "New dependency mod IDs (comma separated)")
  .option("-y, --yes", "Skip interactive prompts and confirmation")
  .action(updateMod);

mod
  .command("delete <id>")
  .description("Permanently delete a mod")
  .action(deleteMod);

program.parse(process.argv);
