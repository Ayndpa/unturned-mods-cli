import prompts from "prompts";

// Handle Ctrl+C or cancellation gracefully
function onCancel() {
  console.log("\nOperation cancelled.");
  process.exit(0);
}

export async function askText(message: string, initial = "", validate?: (val: string) => boolean | string): Promise<string> {
  const response = await prompts({
    type: "text",
    name: "value",
    message,
    initial,
    validate,
  }, { onCancel });
  return response.value;
}

export async function askPassword(message: string): Promise<string> {
  const response = await prompts({
    type: "password",
    name: "value",
    message,
    validate: (val) => (val ? true : "Password cannot be empty"),
  }, { onCancel });
  return response.value;
}

export async function askConfirm(message: string, initial = true): Promise<boolean> {
  const response = await prompts({
    type: "confirm",
    name: "value",
    message,
    initial,
  }, { onCancel });
  return response.value;
}

export async function askSelect(message: string, choices: { title: string; value: any }[]): Promise<any> {
  const response = await prompts({
    type: "select",
    name: "value",
    message,
    choices,
  }, { onCancel });
  return response.value;
}
