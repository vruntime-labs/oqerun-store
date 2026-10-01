import fs from "node:fs/promises";

const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error("GITHUB_TOKEN is required.");

const config = JSON.parse(await fs.readFile("scripts/catalog-sources.json", "utf8"));
const headers = {
  Accept: "application/vnd.github+json",
  Authorization: "Bearer " + token,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "oqerun-store-catalog-sync"
};

async function github(path) {
  const response = await fetch("https://api.github.com" + path, { headers });
  if (!response.ok) throw new Error("GitHub API " + response.status + ": " + path);
  return response.json();
}

async function discoverAssets(homepage) {
  const result = { iconUrl: undefined, screenshots: [] };
  try {
    const page = await fetch(homepage, { headers: { "User-Agent": "Oqerun-Store-Catalog-Sync" } });
    if (!page.ok) return result;
    const html = await page.text();
    const origin = new URL(homepage);
    const resolve = (value) => {
      try { return new URL(value, origin).toString(); } catch { return undefined; }
    };

    const manifestMatch = html.match(/<link[^>]+rel=["'][^"']*manifest[^"']*["'][^>]+href=["']([^"']+)["']/i)
      || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*manifest[^"']*["']/i);

    if (manifestMatch?.[1]) {
      const manifestUrl = resolve(manifestMatch[1]);
      if (manifestUrl) {
        const manifestResponse = await fetch(manifestUrl, { headers: { "User-Agent": "Oqerun-Store-Catalog-Sync" } });
        if (manifestResponse.ok) {
          const manifest = await manifestResponse.json();
          const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
          const icon = icons
            .filter((item) => item?.src)
            .sort((a, b) => (parseInt(b.sizes?.split("x")[0] || "0") - parseInt(a.sizes?.split("x")[0] || "0")))[0];
          if (icon) result.iconUrl = resolve(icon.src);
          if (Array.isArray(manifest.screenshots)) {
            result.screenshots = manifest.screenshots.map((item) => resolve(item?.src)).filter(Boolean).slice(0, 6);
          }
        }
      }
    }

    if (!result.iconUrl) {
      const iconMatch = html.match(/<link[^>]+(?:rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*)["'][^>]+href=["']([^"']+)["']/i)
        || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["']/i);
      if (iconMatch?.[1]) result.iconUrl = resolve(iconMatch[1]);
    }

    if (!result.iconUrl) {
      const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
      if (og?.[1]) result.iconUrl = resolve(og[1]);
    }

    if (!result.screenshots.length) {
      const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
      if (og?.[1]) result.screenshots = [resolve(og[1])].filter(Boolean);
    }
  } catch {}
  return result;
}

function category(repo) {
  const topics = new Set(repo.topics ?? []);
  if ([...topics].some(t => ["game", "games", "html5-game", "opensource-game"].includes(t))) return "Games";
  if (topics.has("education")) return "Education";
  if (topics.has("music") || topics.has("audio") || topics.has("video")) return "Media";
  if (topics.has("developer-tools") || topics.has("development")) return "Development";
  if (topics.has("graphics") || topics.has("drawing")) return "Graphics";
  return "Utilities";
}

function type(repo) {
  const topics = new Set(repo.topics ?? []);
  if (topics.has("webassembly") || topics.has("wasm")) return "wasm";
  if (topics.has("pwa") || topics.has("progressive-web-app")) return "pwa";
  return "web";
}

function icon(repo) {
  const c = category(repo);
  if (c === "Games") return "🎮";
  if (c === "Media") return "♫";
  if (c === "Development") return "</>";
  if (c === "Graphics") return "✦";
  return "◉";
}

const repositories = new Map();
for (const query of config.queries) {
  const result = await github("/search/repositories?q=" + encodeURIComponent(query) + "&sort=stars&order=desc&per_page=" + config.perQuery);
  for (const repo of result.items ?? []) repositories.set(repo.full_name, repo);
}

const apps = [];
for (const repo of repositories.values()) {
  if (apps.length >= config.maxApps) break;
  if (repo.archived || repo.disabled || !repo.homepage || !repo.license?.spdx_id || repo.license.spdx_id === "NOASSERTION") continue;
  if (!/^https?:\/\//i.test(repo.homepage)) continue;

  const safeId = "community.github." + repo.full_name.toLowerCase().replace(/[^a-z0-9]+/g, ".");
  const appType = type(repo);\n  const assets = await discoverAssets(repo.homepage);\n  apps.push({
    id: safeId,
    name: repo.name.replace(/[-_]+/g, " "),
    version: "0.0.0",
    description: (repo.description || "Open-source web application for Oqerun Store.").slice(0, 300),
    category: category(repo),
    icon: icon(repo),
    featured: false,
    publisher: { name: repo.owner?.login || "GitHub community", verified: false },\n    metadata: {\n      iconUrl: assets.iconUrl,\n      screenshots: assets.screenshots,
    listing: "community",
    source: { type: "github", repository: repo.full_name },
    license: repo.license.spdx_id,
    type: appType,
    compatibility: { minimumOqerunVersion: "0.1.0" },
    installation: { method: appType, url: repo.homepage },
    permissions: ["network"],
    fileAssociations: [],
    metadata: {
      homepage: repo.homepage,
      lastUpdated: repo.updated_at?.slice(0, 10),
      offline: (repo.topics ?? []).includes("offline") || (repo.topics ?? []).includes("offline-first"),
      versionStrategy: "rolling",
      reviewStatus: "unverified",
      tags: (repo.topics ?? []).slice(0, 12),
      discoverySource: "github-topic-discovery"
    }
  });
}

apps.sort((a, b) => a.name.localeCompare(b.name));
const output = [
  'import type { Application } from "../models/App";',
  "",
  "/** Generated by scripts/sync-catalog.mjs. Community discovery is unverified until reviewed. */",
  "export const remoteCatalog: Application[] = " + JSON.stringify(apps, null, 2) + ";",
  ""
].join("\n");

await fs.writeFile("src/data/remoteCatalog.ts", output);
console.log("Generated " + apps.length + " community candidates.");
