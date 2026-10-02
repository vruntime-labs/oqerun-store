import fs from "node:fs";

const body = process.env.ISSUE_BODY || "";
const token = process.env.GITHUB_TOKEN || "";

function field(label) {
  const escaped = label.replace(/[.*+?^()|[\]{}]/g, "\\$&");
  const re = new RegExp("^#{2,3} " + escaped + "\\s*$\\n([\\s\\S]*?)(?=^#{2,3} |$)", "m");
  const match = body.match(re);
  return match ? match[1].trim() : "";
}

function extractRepoUrl(value) {
  try {
    const url = new URL(value.trim());
    if (!["github.com", "www.github.com"].includes(url.hostname.toLowerCase())) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/i, "") };
  } catch {
    return null;
  }
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function isPrivateHost(hostname) {
  const h = hostname.toLowerCase();
  return h === "localhost" || h === "::1" || h.endsWith(".local") ||
    /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(h);
}

async function github(path) {
  const response = await fetch("https://api.github.com" + path, {
    headers: {
      "Accept": "application/vnd.github+json",
      "User-Agent": "Oqerun-Store-Submission-Scanner",
      ...(token ? { Authorization: "Bearer " + token } : {})
    }
  });
  if (!response.ok) throw new Error("GitHub API " + response.status + " for " + path);
  return response.json();
}

function line(label, value) {
  return "- **" + label + ":** " + value;
}

async function scan() {
  const repoValue = field("GitHub Repository URL");
  const liveValue = field("Live App URL");
  const appName = field("App Name") || "Unnamed app";
  const submittedType = field("Application Type") || "Not specified";
  const repo = extractRepoUrl(repoValue);

  const lines = [
    "## Oqerun Store automated scan",
    "",
    "<!-- oqerun-store-scan -->",
    "**App:** " + appName,
    "**Submitted type:** " + submittedType,
    "**Repository:** " + (repoValue || "Not provided"),
    ""
  ];

  if (!repo) {
    lines.push("### Result", "", "❌ **Needs review** — the GitHub Repository URL could not be parsed.");
    return lines.join("\n");
  }

  try {
    const meta = await github("/repos/" + encodeURIComponent(repo.owner) + "/" + encodeURIComponent(repo.repo));

    const tree = await github(
      "/repos/" + encodeURIComponent(repo.owner) + "/" + encodeURIComponent(repo.repo) +
      "/git/trees/" + encodeURIComponent(meta.default_branch) + "?recursive=1"
    );

    const paths = (tree.tree || [])
      .filter(x => x.type === "blob")
      .map(x => x.path.toLowerCase());

    const hasOqpkg = paths.some(p => p.endsWith(".oqpkg"));
    const hasWasm = paths.some(p => p.endsWith(".wasm"));
    const hasIndex = paths.some(p => /(^|\/)index\.html$/.test(p));
    const hasManifest = paths.some(p => /(^|\/)(manifest\.json|manifest\.webmanifest)$/.test(p));
    const hasServiceWorker = paths.some(p => /(^|\/)(sw|service-worker)(\.[^/]+)?\.js$/.test(p));
    const hasWebBuild = paths.some(p =>
      /(^|\/)(package\.json|vite\.config\.[cm]?[jt]s|webpack\.config\.[cm]?js|astro\.config\.[cm]?js|next\.config\.[cm]?js)$/.test(p)
    );
    const hasReadme = paths.some(p => /(^|\/)(readme|readme\.md|readme\.txt)$/.test(p));
    const hasLicense = paths.some(p => /(^|\/)(license|licence)(\.[^/]+)?$/.test(p));
    const nativeOnly = paths.some(p => /(^|\/)([^/]+\.(exe|msi|dmg|appimage|deb|rpm|apk|ipa))$/.test(p));

    let inferred = "not-compatible";
    if (hasOqpkg) inferred = "native";
    else if (hasWasm && (hasIndex || hasManifest || hasWebBuild)) inferred = "wasm";
    else if (hasIndex || hasManifest || hasServiceWorker || hasWebBuild) inferred = "web";
    else if (nativeOnly) inferred = "needs-review";

    let liveResult = null;
    const liveUrl = safeUrl(liveValue);

    if (liveUrl && !isPrivateHost(liveUrl.hostname)) {
      try {
        const response = await fetch(liveUrl, {
          redirect: "manual",
          headers: { "User-Agent": "Oqerun-Store-Submission-Scanner" }
        });
        liveResult = { ok: response.status >= 200 && response.status < 400, status: response.status };
      } catch (error) {
        liveResult = { ok: false, status: String(error.message || error) };
      }
    }

    const required = [
      ["Repository is public", !meta.private],
      ["Repository is not archived", !meta.archived]
    ];

    if (inferred === "native") {
      required.push([".oqpkg package detected", hasOqpkg]);
    } else if (inferred === "web") {
      required.push(["Web application files detected", hasIndex || hasManifest || hasWebBuild || hasServiceWorker]);
      required.push(["Live HTTPS URL reachable", Boolean(liveResult?.ok)]);
    } else if (inferred === "wasm") {
      required.push(["WebAssembly module detected", hasWasm]);
      required.push(["Web application shell detected", hasIndex || hasManifest || hasWebBuild]);
      required.push(["Live HTTPS URL reachable", Boolean(liveResult?.ok)]);
    } else {
      required.push(["Supported Store format detected", false]);
    }

    const optional = [
      ["PWA manifest", hasManifest],
      ["Service worker", hasServiceWorker],
      ["WebAssembly module", hasWasm],
      [".oqpkg package", hasOqpkg],
      ["README", hasReadme],
      ["License file", hasLicense]
    ];

    const requiredFailures = required.filter(([, ok]) => !ok);
    const detected = [
      ["Web entrypoint", hasIndex],
      ["PWA manifest", hasManifest],
      ["Service worker", hasServiceWorker],
      ["Web build metadata", hasWebBuild],
      ["WebAssembly", hasWasm],
      [".oqpkg", hasOqpkg],
      ["README", hasReadme],
      ["License", hasLicense]
    ].filter(([, ok]) => ok);

    let result;
    if (tree.truncated) {
      result = "Needs review";
    } else if (inferred === "not-compatible") {
      result = "Not compatible";
    } else if (requiredFailures.length > 0) {
      result = "Needs review";
    } else {
      result = "Ready for review";
    }

    const recommendation =
      result === "Ready for review"
        ? "The submission meets the automated compatibility requirements for its detected type. Continue with normal Store review."
        : result === "Not compatible"
          ? "No supported Oqerun Store format was detected. The maintainer should provide a supported package, web application, or WebAssembly project."
          : "One or more required compatibility checks need attention. Manual review is required.";

    lines.push(
      "### Result",
      "",
      "- **Status:** " + result,
      "- **Detected type:** " + inferred,
      "",
      "### Required compatibility checks",
      "",
      ...required.map(([name, ok]) => "- " + (ok ? "✅" : "❌") + " " + name),
      "",
      "### Optional capabilities",
      "",
      ...optional.map(([name, ok]) => "- " + (ok ? "✅" : "—") + " " + name),
      "",
      "### Detected repository features",
      "",
      ...(detected.length ? detected.map(([name]) => "- " + name) : ["- None detected"]),
      "",
      "### Recommendation",
      "",
      recommendation,
      "",
      "This automated scan inspects repository metadata and files. It does **not** execute submitted repository code and is not an approval decision."
    );

    if (liveResult) {
      lines.push(
        "",
        "### Live application",
        "",
        line("URL", liveValue),
        line("HTTP check", liveResult.ok ? "Reachable (" + liveResult.status + ")" : "Not confirmed (" + liveResult.status + ")")
      );
    }

    if (tree.truncated) {
      lines.push("", "⚠️ GitHub reported a truncated repository tree; manual review is required.");
    }

    return lines.join("\n");
  } catch (error) {
    lines.push(
      "### Result",
      "",
      "⚠️ **Needs review** — scanner error: " + String(error.message || error)
    );
    return lines.join("\n");
  }
}

scan().then(async report => {
  fs.writeFileSync("submission-scan-report.md", report + "\n", "utf8");

  if (!body.match(/<!--\s*oqerun-store-submission\s*-->/)) process.exit(0);

  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !token) process.exit(0);

  const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
  const owner = event.repository?.owner?.login;
  const repo = event.repository?.name;
  const issueNumber = event.issue?.number;
  if (!owner || !repo || !issueNumber) process.exit(0);

  const response = await fetch(
    "https://api.github.com/repos/" + owner + "/" + repo + "/issues/" + issueNumber + "/comments",
    {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": "Bearer " + token,
        "User-Agent": "Oqerun-Store-Submission-Scanner",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ body: report })
    }
  );

  if (!response.ok) throw new Error("Could not post scan report to issue: " + response.status);
}).catch(error => {
  fs.writeFileSync(
    "submission-scan-report.md",
    "## Oqerun Store automated scan\n\n❌ Scanner failed: " + String(error.message || error) + "\n",
    "utf8"
  );
  process.exitCode = 1;
});
