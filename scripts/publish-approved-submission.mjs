import fs from "node:fs";

const issueBody = process.env.ISSUE_BODY || "";
const issueNumber = process.env.ISSUE_NUMBER || "";
const token = process.env.GITHUB_TOKEN || "";
const repoFullName = process.env.REPOSITORY || "";

function field(label) {
  const escaped = label.replace(/[.*+?^()|[\]{}]/g, "\\$&");
  const re = new RegExp("^#{2,3} " + escaped + "\\s*$\\n([\\s\\S]*?)(?=^#{2,3} |$)", "m");
  const match = issueBody.match(re);
  return match ? match[1].trim() : "";
}

function repoFromUrl(value) {
  try {
    const url = new URL(value);
    if (!["github.com", "www.github.com"].includes(url.hostname.toLowerCase())) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/i, "") };
  } catch {
    return null;
  }
}

function slug(value) {
  return value.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "app";
}

function escapeTs(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function category(value) {
  const allowed = ["Productivity", "Development", "Education", "Graphics", "Media", "Utilities", "Games", "Internet", "System"];
  return allowed.includes(value) ? value : "Utilities";
}

function appType(value) {
  if (value.includes(".oqpkg")) return { type: "native", method: "oqpkg" };
  if (value.toLowerCase().includes("pwa")) return { type: "pwa", method: "pwa" };
  if (value.toLowerCase().includes("webassembly")) return { type: "wasm", method: "web" };
  return { type: "web", method: "web" };
}

async function github(path, options = {}) {
  const response = await fetch("https://api.github.com" + path, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "User-Agent": "Oqerun-Store-Approval-Workflow",
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error("GitHub API " + response.status + " for " + path);
  return response.json();
}

async function main() {
  const appName = field("App Name");
  const description = field("App Description");
  const publisher = field("Publisher / Developer Name");
  const license = field("License") || "Unknown";
  const repoUrl = field("GitHub Repository URL");
  const liveUrl = field("Live App URL");
  const submittedType = field("Application Type");
  const source = repoFromUrl(repoUrl);

  if (!appName || !source) throw new Error("Submission is missing App Name or a valid GitHub Repository URL.");

  const catalogPath = "src/data/catalog.ts";
  const catalog = fs.readFileSync(catalogPath, "utf8");
  const id = "com.oqerun." + slug(appName);

  if (catalog.includes("id: '" + id + "'")) {
    throw new Error("Catalog entry already exists for " + id + ".");
  }

  const meta = await github("/repos/" + encodeURIComponent(source.owner) + "/" + encodeURIComponent(source.repo));
  let version = "1.0.0";

  try {
    const releases = await github("/repos/" + encodeURIComponent(source.owner) + "/" + encodeURIComponent(source.repo) + "/releases?per_page=1");
    if (Array.isArray(releases) && releases[0]?.tag_name) {
      version = String(releases[0].tag_name).replace(/^v/i, "") || version;
    }
  } catch {}

  const kind = appType(submittedType);
  const installUrl = liveUrl || meta.homepage || ("https://github.com/" + source.owner + "/" + source.repo);
  const publisherName = publisher || source.owner;

  const entry = `  {
    id: '${escapeTs(id)}',
    name: '${escapeTs(appName)}',
    version: '${escapeTs(version)}',
    description: '${escapeTs(description || meta.description || "Open-source application submitted to Oqerun Store.")}',
    category: '${escapeTs(category(field("App Category")))}',
    icon: '▣',
    featured: false,
    publisher: { name: '${escapeTs(publisherName)}', verified: ${source.owner.toLowerCase() === "vruntime-labs" ? "true" : "false"} },
    listing: 'official',
    source: { type: 'github', repository: '${escapeTs(source.owner + "/" + source.repo)}' },
    license: '${escapeTs(license)}',
    type: '${kind.type}',
    compatibility: { minimumOqerunVersion: '0.1.0' },
    installation: { method: '${kind.method}', url: '${escapeTs(installUrl)}' },
    permissions: ['network'],
    fileAssociations: [],
    metadata: {
      homepage: '${escapeTs(installUrl)}',
      tags: ['${escapeTs(category(field("App Category")).toLowerCase())}'],
      versionStrategy: 'catalog',
      reviewStatus: 'official'
    }
  },
`;

  const marker = "\n];";
  const index = catalog.lastIndexOf(marker);
  if (index < 0) throw new Error("Could not find catalog array closing marker.");

  fs.writeFileSync(catalogPath, catalog.slice(0, index) + "\n" + entry + catalog.slice(index), "utf8");

  const comment = [
    "## Oqerun Store publishing",
    "",
    "✅ **Approved and added to the catalog.**",
    "",
    "- **App:** " + appName,
    "- **Catalog ID:** " + id,
    "- **Version:** " + version,
    "- **Detected type:** " + kind.type,
    "- **Repository:** " + source.owner + "/" + source.repo,
    "",
    "The catalog entry was generated automatically from the approved submission. Icon/screenshot enrichment and the normal Store build remain separate steps."
  ].join("\n");

  await github("/repos/" + repoFullName + "/issues/" + issueNumber + "/comments", {
    method: "POST",
    body: JSON.stringify({ body: comment })
  });
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
