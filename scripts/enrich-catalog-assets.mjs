import fs from "node:fs/promises";

const source = await fs.readFile("src/data/catalog.ts", "utf8");
const apps = [];
const pattern = /\{\s*id:\s*['"]([^'"]+)['"][\s\S]*?source:\s*\{\s*type:\s*['"]github['"],\s*repository:\s*['"]([^'"]+)['"][\s\S]*?installation:\s*\{\s*method:\s*['"][^'"]+['"],\s*url:\s*['"]([^'"]+)['"]/g;

function resolve(value, base) {
  try { return new URL(value, base).toString(); } catch { return undefined; }
}

async function discover(homepage) {
  const result = { iconUrl: undefined, screenshots: [] };
  try {
    const response = await fetch(homepage, { headers: { "User-Agent": "Oqerun-Store-Asset-Sync" } });
    if (!response.ok) return result;
    const html = await response.text();
    const manifestMatch =
      html.match(/<link[^>]+rel=["'][^"']*manifest[^"']*["'][^>]+href=["']([^"']+)["']/i) ||
      html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*manifest[^"']*["']/i);

    if (manifestMatch?.[1]) {
      const manifestUrl = resolve(manifestMatch[1], homepage);
      if (manifestUrl) {
        const manifestResponse = await fetch(manifestUrl, { headers: { "User-Agent": "Oqerun-Store-Asset-Sync" } });
        if (manifestResponse.ok) {
          const manifest = await manifestResponse.json();
          const icons = Array.isArray(manifest.icons) ? manifest.icons.filter(x => x?.src) : [];
          icons.sort((a, b) => Number.parseInt(b.sizes?.split("x")[0] || "0") - Number.parseInt(a.sizes?.split("x")[0] || "0"));
          if (icons[0]) result.iconUrl = resolve(icons[0].src, manifestUrl);
          if (Array.isArray(manifest.screenshots)) {
            result.screenshots = manifest.screenshots.map(x => resolve(x?.src, manifestUrl)).filter(Boolean).slice(0, 6);
          }
        }
      }
    }

    if (!result.iconUrl) {
      const iconMatch =
        html.match(/<link[^>]+(?:rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*)["'][^>]+href=["']([^"']+)["']/i) ||
        html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["']/i);
      if (iconMatch?.[1]) result.iconUrl = resolve(iconMatch[1], homepage);
    }

    if (!result.iconUrl) {
      const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
      if (og?.[1]) result.iconUrl = resolve(og[1], homepage);
    }

    if (!result.screenshots.length) {
      const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
      if (og?.[1]) result.screenshots = [resolve(og[1], homepage)].filter(Boolean);
    }
  } catch {}
  return result;
}

let match;
while ((match = pattern.exec(source))) {
  apps.push({ id: match[1], repository: match[2], homepage: match[3] });
}

const assets = {};
for (const app of apps) {
  const discovered = await discover(app.homepage);
  assets[app.id] = discovered;
  console.log(app.id + ": " + (discovered.iconUrl ? "icon" : "no icon") + ", " + discovered.screenshots.length + " screenshot(s)");
}

await fs.writeFile(
  "src/data/catalogAssets.ts",
  "export const catalogAssets = " + JSON.stringify(assets, null, 2) + " as const;\n"
);
