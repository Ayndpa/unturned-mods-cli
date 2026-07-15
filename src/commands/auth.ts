import { loadConfig, saveConfig, clearConfig } from "../config";
import { getJson } from "../api";
import { askText, askPassword, askSelect } from "../utils/prompts";
import pc from "picocolors";
import ora from "ora";

const SUCCESS_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Login Successful</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f5f5f5;
      color: #0a0a0a;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
    }
    .card {
      background: white;
      padding: 40px;
      border-radius: 24px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.04);
      text-align: center;
      border: 1px solid #e5e5e5;
      max-width: 400px;
      width: 100%;
    }
    h1 { margin-top: 0; font-size: 24px; font-weight: 600; color: #0a0a0a; }
    p { color: #737373; font-size: 14px; margin-bottom: 0px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <h1>✓ Authentication Successful</h1>
    <p>Your CLI has been authorized. You can now close this tab and return to your terminal.</p>
  </div>
</body>
</html>
`;

function openBrowser(url: string) {
  const os = process.platform;
  if (os === "win32") {
    Bun.spawn(["cmd", "/c", "start", url]);
  } else if (os === "darwin") {
    Bun.spawn(["open", url]);
  } else {
    Bun.spawn(["xdg-open", url]);
  }
}

async function verifyAndSaveToken(host: string, token: string) {
  // Temporarily set credentials so api client uses them
  await saveConfig({ host, token });

  try {
    const data = await getJson("/api/auth/me");
    if (!data || !data.user) {
      await clearConfig();
      throw new Error("Invalid or expired token returned from server.");
    }
    const user = data.user;
    await saveConfig({
      host,
      token,
      username: user.username,
      role: user.role,
      userId: user.id,
    });
    return user;
  } catch (error) {
    await clearConfig();
    throw error;
  }
}

export async function login(options: { host?: string }) {
  const currentConfig = await loadConfig();
  const host = (options.host || currentConfig.host || "http://localhost:3000").replace(/\/$/, "");

  const port = 52026;
  const spinner = ora("Starting local authentication server...").start();

  let server: any;
  try {
    server = Bun.serve({
      port,
      async fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/callback") {
          const token = url.searchParams.get("token");
          if (token) {
            // Complete in background
            setTimeout(async () => {
              try {
                const user = await verifyAndSaveToken(host, token);
                spinner.succeed(`Logged in successfully as ${pc.cyan(user.username)} (${pc.green(user.role)})`);
              } catch (err: any) {
                spinner.fail(`Failed to verify web login: ${err.message}`);
              } finally {
                server.stop();
              }
            }, 100);

            return new Response(SUCCESS_HTML, {
              headers: { "Content-Type": "text/html; charset=utf-8" },
            });
          } else {
            setTimeout(() => {
              spinner.fail("Web login failed: No token received");
              server.stop();
            }, 100);
            return new Response("Failed: No token received", { status: 400 });
          }
        }
        return new Response("Not found", { status: 404 });
      },
    });
  } catch (e: any) {
    spinner.fail(`Failed to start local server on port ${port}: ${e.message}`);
    return;
  }

  const loginUrl = `${host}/login?next=/api/auth/cli-login?port=${port}`;
  spinner.text = `Opening browser for login at ${pc.dim(host)}...`;
  openBrowser(loginUrl);
  console.log(`\nIf the browser didn't open automatically, please visit:\n  ${pc.cyan(loginUrl)}\n`);
}

export async function logout() {
  const spinner = ora("Logging out...").start();
  try {
    await clearConfig();
    spinner.succeed("Logged out successfully. Local credentials cleared.");
  } catch (e: any) {
    spinner.fail(`Logout failed: ${e.message}`);
  }
}

export async function status() {
  const config = await loadConfig();
  console.log(`\nPlatform Host: ${pc.cyan(config.host)}`);
  
  if (config.token && config.username) {
    console.log(`Status:        ${pc.green("✓ Logged In")}`);
    console.log(`User:          ${pc.cyan(config.username)}`);
    console.log(`Role:          ${pc.green(config.role || "user")}`);
  } else {
    console.log(`Status:        ${pc.yellow("✗ Not Logged In")}`);
    console.log(`Run ${pc.bold("utmod auth login")} to log in.`);
  }
  console.log();
}
