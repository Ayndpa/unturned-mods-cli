import Table from "cli-table3";
import pc from "picocolors";

export function createTable(headers: string[]) {
  return new Table({
    head: headers.map((h) => pc.bold(h)),
    style: {
      head: [], // Remove default colors
      border: [],
    },
    chars: {
      top: "─",
      "top-mid": "┬",
      "top-left": "┌",
      "top-right": "┐",
      bottom: "─",
      "bottom-mid": "┴",
      "bottom-left": "└",
      "bottom-right": "┘",
      left: "│",
      "left-mid": "├",
      right: "│",
      "right-mid": "┤",
      mid: "─",
      "mid-mid": "┼",
      middle: "│",
    },
  });
}

export function formatStatus(status: string, rejectReason?: string | null): string {
  switch (status) {
    case "approved":
      return pc.green("✓ Approved");
    case "pending":
      return pc.yellow("⧗ Pending");
    case "rejected":
      const suffix = rejectReason ? ` (${rejectReason})` : "";
      return pc.red(`✗ Rejected${suffix}`);
    default:
      return status;
  }
}

export function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
