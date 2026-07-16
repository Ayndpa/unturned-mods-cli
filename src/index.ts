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
  .option("--title <title>", "Title (legacy: default language zh)")
  .option("--title-zh <title>", "Title (Chinese)")
  .option("--title-en <title>", "Title (English)")
  .option("--description <desc>", "Brief description (legacy: zh)")
  .option("--desc-zh <desc>", "Description (Chinese)")
  .option("--desc-en <desc>", "Description (English)")
  .option("--body <body>", "Body markdown or file path (legacy: zh)")
  .option("--body-zh <body>", "Body markdown or file (Chinese)")
  .option("--body-en <body>", "Body markdown or file (English)")
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
  .option("--title <title>", "New title (legacy: zh)")
  .option("--title-zh <title>", "New title (Chinese)")
  .option("--title-en <title>", "New title (English)")
  .option("--description <desc>", "New description (legacy: zh)")
  .option("--desc-zh <desc>", "New description (Chinese)")
  .option("--desc-en <desc>", "New description (English)")
  .option("--body <body>", "New body or file path (legacy: zh)")
  .option("--body-zh <body>", "New body (Chinese)")
  .option("--body-en <body>", "New body (English)")
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
