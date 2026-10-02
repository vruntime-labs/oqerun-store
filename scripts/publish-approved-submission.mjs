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
    if (url.protocol !== "https:" || !["github.com", "www.github.com"].includes(url.hostname.toLowerCase())) return null;
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
  const allowed = ["Productivity", "Development", "Education", "Graphics", "Media", "Utilities", "Games", "Internet", "System", "Other"];
  if (!allowed.includes(value)) throw new Error("Invalid App Category: " + value);
  return value === "Other" ? "Utilities" : value;
}

function submittedType(value) {
  const normalized = value.toLowerCase();
  if (normalized.includes(".oqpkg")) return "native";
  if (normalized.includes("pwa")) return "pwa";
  if (normalized.includes("webassembly")) return "wasm";
  if (normalized.includes("web app")) return "web";
  return "other";
}

function spdx(value) {
  return String(value || "").trim().toUpperCase();
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
  if (!response.ok) {
    const body = await response.text();
    throw new Error("GitHub API " + response.status + " for " + path + ": " + body.slice(0, 500));
  }
  return response.json();
}

async function repositoryFiles(owner, repo) {
  const tree = await github("/repos/" + encodeURIComponent(owner) + "/" + encodeURIComponent(repo) + "/git/trees/HEAD?recursive=1");
  if (tree.truncated) throw new Error("Repository tree is too large to validate automatically.");
  return new Set((tree.tree || []).filter(item => item.type === "blob").map(item => item.path.toLowerCase()));
}

function hasAny(files, names) {
  return names.some(name => files.has(name));
}

function detectCompatibility(files, requested) {
  const manifest = hasAny(files, ["manifest.json", "public/manifest.json", "src/manifest.json", "web/manifest.json"]);
  const serviceWorker = [...files].some(path =>
    /(^|\/)(service-worker|serviceworker|sw)\.(js|mjs|ts)$/.test(path) ||
    path.endsWith("/service-worker.js") ||
    path.endsWith("/service-worker.mjs")
  );
  const wasm = [...files].some(path => path.endsWith(".wasm"));
  const oqpkg = [...files].some(path => path.endsWith(".oqpkg"));

  if (requested === "pwa" && !(manifest && serviceWorker)) {
    throw new Error("Submission says PWA, but the repository does not contain both a web manifest and a detectable service worker. Submit it as Web App unless the PWA files are added.");
  }
  if (requested === "wasm" && !wasm) {
    throw new Error("Submission says WebAssembly, but no .wasm file was found in the repository.");
  }
  if (requested === "native" && !oqpkg) {
    throw new Error("Submission says .oqpkg native, but no .oqpkg package was found in the repository.");
  }

  return requested === "pwa" ? { type: "pwa", method: "pwa" }
    : requested === "wasm" ? { type: "wasm", method: "web" }
    : requested === "native" ? { type: "native", method: "oqpkg" }
    : { type: "web", method: "web" };
}

async function main() {
  if (!token || !repoFullName || !issueNumber) throw new Error("Missing required workflow environment.");

  const appName = field("App Name");
  const description = field("App Description");
  const publisher = field("Publisher / Developer Name");
  const submittedLicense = field("License");
  const repoUrl = field("GitHub Repository URL");
  const liveUrl = field("Live App URL");
  const submittedType = submittedType(field("Application Type"));
  const authorization = field("Authorization");
  const source = repoFromUrl(repoUrl);

  if (!appName || appName.length < 2) throw new Error("Submission is missing a valid App Name.");
  if (!description || description.length < 20) throw new Error("App Description must be at least 20 characters.");
  if (!publisher) throw new Error("Publisher / Developer Name is required.");
  if (!source) throw new Error("GitHub Repository URL must be a valid HTTPS GitHub repository URL.");
  if (authorization.toLowerCase() !== "i agree" && !authorization.toLowerCase().includes("confirm")) {
    throw new Error("Authorization confirmation is required.");
  }
  if (submittedType === "other") throw new Error("Application Type must be .oqpkg, PWA, Web App, or WebAssembly.");

  if (liveUrl) {
    const parsed = new URL(liveUrl);
    if (parsed.protocol !== "https:") throw new Error("Live App URL must use HTTPS.");
  }
  if ((submittedType === "web" || submittedType === "pwa") && !liveUrl) {
    throw new Error("Live App URL is required for Web App and PWA submissions.");
  }

  const catalogPath = "src/data/catalog.ts";
  const noticesPath = "THIRD-PARTY-NOTICES.md";
  const catalog = fs.readFileSync(catalogPath, "utf8");
  const notices = fs.readFileSync(noticesPath, "utf8");
  const id = "com.oqerun." + slug(appName);

  if (catalog.includes("id: '" + id + "'") || catalog.includes('id: "' + id + '"')) {
    throw new Error("Catalog entry already exists for " + id + ".");
  }
  if (catalog.includes("repository: '" + source.owner + "/" + source.repo + "'") ||
      catalog.includes('repository: "' + source.owner + "/" + source.repo + '"')) {
    throw new Error("This repository is already present in the Store catalog.");
  }

  const meta = await github("/repos/" + encodeURIComponent(source.owner) + "/" + encodeURIComponent(source.repo));
  if (meta.private) throw new Error("Repository must be public.");
  if (meta.archived) throw new Error("Repository is archived and cannot be published as a new Store listing.");
  if (!meta.default_branch) throw new Error("Repository has no default branch.");
  if (!meta.license?.spdx_id) throw new Error("Repository license could not be detected. Add a recognized open-source license before submission.");

  const declaredLicense = spdx(submittedLicense);
  const repositoryLicense = spdx(meta.license.spdx_id);
  if (declaredLicense !== repositoryLicense) {
    throw new Error("Declared license (" + submittedLicense + ") does not match repository license (" + meta.license.spdx_id + ").");
  }

  const files = await repositoryFiles(source.owner, source.repo);
  const kind = detectCompatibility(files, submittedType);
  const installUrl = liveUrl || meta.homepage || ("https://github.com/" + source.owner + "/" + source.repo);
  const publisherName = publisher || source.owner;

  let version = "1.0.0";
  try {
    const releases = await github("/repos/" + encodeURIComponent(source.owner) + "/" + encodeURIComponent(source.repo) + "/releases?per_page=1");
    if (Array.isArray(releases) && releases[0]?.tag_name) {
      version = String(releases[0].tag_name).replace(/^v/i, "") || version;
    }
  } catch {}

  const isFirstParty = source.owner.toLowerCase() === "vruntime-labs";
  const listing = isFirstParty ? "official" : "community";
  const reviewStatus = isFirstParty ? "official" : "unverified";
  const entry = `  {
    id: '${escapeTs(id)}',
    name: '${escapeTs(appName)}',
    version: '${escapeTs(version)}',
    description: '${escapeTs(description || meta.description || "Open-source application submitted to Oqerun Store.")}',
    category: '${escapeTs(category(field("App Category")))}',
    icon: '▣',
    featured: false,
    publisher: { name: '${escapeTs(publisherName)}', verified: ${isFirstParty ? "true" : "false"} },
    listing: '${listing}',
    source: { type: 'github', repository: '${escapeTs(source.owner + "/" + source.repo)}' },
    license: '${escapeTs(meta.license.spdx_id)}',
    type: '${kind.type}',
    compatibility: { minimumOqerunVersion: '0.1.0' },
    installation: { method: '${kind.method}', url: '${escapeTs(installUrl)}' },
    permissions: ['network'],
    fileAssociations: [],
    metadata: {
      homepage: '${escapeTs(installUrl)}',
      tags: ['${escapeTs(category(field("App Category")).toLowerCase())}'],
      versionStrategy: 'catalog',
      reviewStatus: '${reviewStatus}',
      discoverySource: 'Oqerun Store submission'
    }
  },
`;

  const marker = "\n];";
  const index = catalog.lastIndexOf(marker);
  if (index < 0) throw new Error("Could not find catalog array closing marker.");
  fs.writeFileSync(catalogPath, catalog.slice(0, index) + "\n" + entry + catalog.slice(index), "utf8");

  if (!isFirstParty && !notices.includes("https://github.com/" + source.owner + "/" + source.repo)) {
    const notice = `### ${appName}
- Publisher: ${publisherName}
- Repository: https://github.com/${source.owner}/${source.repo}
- License: ${meta.license.spdx_id}
- Store classification: Community
- Review status: Unverified
- Maintainer notification: Required before final publication

`;
    const noticeMarker = "## Attribution and licensing policy";
    const noticeIndex = notices.indexOf(noticeMarker);
    if (noticeIndex < 0) throw new Error("Could not find the third-party notices insertion point.");
    fs.writeFileSync(noticesPath, notices.slice(0, noticeIndex) + notice + notices.slice(noticeIndex), "utf8");
  }

  const comment = [
    "## Oqerun Store publishing",
    "",
    "✅ **Repository validation passed and the catalog entry was generated.**",
    "",
    "- **App:** " + appName,
    "- **Catalog ID:** " + id,
    "- **Version:** " + version,
    "- **Detected type:** " + kind.type,
    "- **Repository:** " + source.owner + "/" + source.repo,
    "- **Repository license:** " + meta.license.spdx_id,
    "- **Listing:** " + listing,
    "- **Review status:** " + reviewStatus,
    "",
    "The Store build must pass before the submission is marked published.",
    "",
    "### Maintainer notification",
    "",
    isFirstParty
      ? "This is a first-party VRuntime Labs application; no external maintainer notification is required."
      : "This is a community application. A maintainer notification issue in the source repository is still required before the listing is considered fully complete. The repository-scoped GitHub Actions token cannot create issues in another repository."
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
