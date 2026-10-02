import fs from "node:fs/promises";

const token = process.env.MAINTAINER_GITHUB_TOKEN;
const maxNotifications = Number(process.env.MAX_NOTIFICATIONS_PER_RUN || "5");

if (!token) {
  console.log("MAINTAINER_GITHUB_TOKEN is not configured; skipping external maintainer notifications.");
  process.exit(0);
}

const raw = await fs.readFile("src/data/remoteCatalog.ts", "utf8");
const start = raw.indexOf("export const remoteCatalog: Application[] = ");
const end = raw.lastIndexOf(";");
if (start < 0 || end <= start) throw new Error("remoteCatalog.ts has an unexpected format.");

const candidates = JSON.parse(raw.slice(start + "export const remoteCatalog: Application[] = ".length, end));
const headers = {
  Accept: "application/vnd.github+json",
  Authorization: "Bearer " + token,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "oqerun-store-maintainer-notifier"
};

async function github(path, options = {}) {
  const response = await fetch("https://api.github.com" + path, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error("GitHub API " + response.status + ": " + path + " — " + body.slice(0, 300));
  }
  return response.json();
}

function parseRepository(value) {
  if (!value || !value.includes("/")) return null;
  const [owner, name] = value.split("/");
  if (!owner || !name) return null;
  return { owner, name };
}

async function alreadyNotified(repository) {
  const query = encodeURIComponent(`repo:${repository} in:body "<!-- oqerun-store-catalog-notification -->"`);
  const result = await github("/search/issues?q=" + query + "&per_page=10");
  return (result.items || []).some(item => item.pull_request == null);
}

function issueBody(app) {
  const repo = app.source?.repository || "";
  const liveUrl = app.installation?.url || app.metadata?.homepage || "";
  return [
    "<!-- oqerun-store-catalog-notification -->",
    "",
    "## Oqerun Store community catalog listing",
    "",
    "Hello! Oqerun Store is an open-source application catalog for Oqerun OS. We discovered this project through GitHub and would like to make the community aware that it is listed as an **unverified community candidate**.",
    "",
    "This is a catalog/metadata listing only. We do not claim ownership of the project or redistribute its source code.",
    "",
    "### Listing information",
    `- **Project:** [${app.name}](https://github.com/${repo})`,
    `- **Live app:** ${liveUrl || "Not provided"}`,
    `- **License:** ${app.license}`,
    `- **Category:** ${app.category}`,
    `- **Type:** ${app.type}`,
    `- **Oqerun Store:** https://vruntime-labs.github.io/oqerun-store/`,
    "",
    "If you prefer that the project not be listed, or any metadata is incorrect, please reply here and we will correct or remove the listing.",
    "",
    "Thank you for maintaining an open-source project."
  ].join("\n");
}

const candidates = candidates
  .filter(app => app?.listing === "community" && app?.metadata?.discoverySource === "github-topic-discovery")
  .sort((a, b) => String(b.metadata?.lastUpdated || "").localeCompare(String(a.metadata?.lastUpdated || "")));

let created = 0;
let skipped = 0;
for (const app of candidates) {
  if (created >= maxNotifications) break;
  const repository = parseRepository(app.source?.repository);
  if (!repository) {
    skipped++;
    continue;
  }

  try {
    if (await alreadyNotified(repository)) {
      skipped++;
      continue;
    }

    const issue = await github(`/repos/${repository.owner}/${repository.name}/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "[Oqerun Store] Community catalog listing",
        body: issueBody(app)
      })
    });

    created++;
    console.log(`Created maintainer notification for ${app.source.repository}: ${issue.html_url}`);
    await new Promise(resolve => setTimeout(resolve, 1500));
  } catch (error) {
    skipped++;
    console.warn(`Could not notify ${app.source.repository}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`Maintainer notification pass complete: ${created} created, ${skipped} skipped.`);
