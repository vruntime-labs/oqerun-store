export type SubmissionStatus = "native" | "web" | "wasm" | "not-compatible" | "needs-review";

export interface ScanCheck {
  label: string;
  status: "pass" | "warn" | "fail" | "info";
  detail: string;
}

export interface SubmissionReport {
  repository: string;
  repositoryUrl: string;
  name: string;
  description: string;
  homepage?: string;
  license: string;
  branch: string;
  archived: boolean;
  filesScanned: number;
  nativePackages: string[];
  webSignals: string[];
  wasmFiles: string[];
  releaseAssets: string[];
  liveUrl?: string;
  liveStatus: "verified" | "unverified" | "not-provided";
  detectedType: "oqpkg" | "pwa" | "web" | "wasm" | "external" | "unknown";
  recommendation: SubmissionStatus;
  checks: ScanCheck[];
  notes: string[];
  scannedAt: string;
}

interface GitHubRepository {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  homepage: string | null;
  default_branch: string;
  archived: boolean;
  disabled: boolean;
  private: boolean;
  license?: { spdx_id?: string | null; name?: string | null } | null;
}

interface GitTreeEntry {
  path: string;
  type: string;
  size?: number;
}

interface GitTreeResponse {
  tree?: GitTreeEntry[];
  truncated?: boolean;
}

interface GitHubRelease {
  tag_name: string;
  assets?: Array<{ name: string; browser_download_url: string; size?: number }>;
}

export class SubmissionScanner {
  private readonly api = "https://api.github.com";

  async scan(repositoryUrl: string, liveUrl?: string): Promise<SubmissionReport> {
    const repository = this.parseRepositoryUrl(repositoryUrl);
    const repo = await this.github<GitHubRepository>("/repos/" + repository.owner + "/" + repository.name);

    if (repo.private || repo.disabled) {
      throw new Error("The submitted GitHub repository must be public and active.");
    }

    const [tree, releases] = await Promise.all([
      this.github<GitTreeResponse>("/repos/" + repository.owner + "/" + repository.name + "/git/trees/" + encodeURIComponent(repo.default_branch) + "?recursive=1"),
      this.github<GitHubRelease[]>("/repos/" + repository.owner + "/" + repository.name + "/releases?per_page=5")
        .catch(() => [])
    ]);

    const entries = (tree.tree ?? []).filter(item => item.type === "blob");
    const paths = entries.map(item => item.path);
    const lower = paths.map(path => path.toLowerCase());

    const nativePackages = paths.filter(path => path.toLowerCase().endsWith(".oqpkg"));
    const wasmFiles = paths.filter(path => path.toLowerCase().endsWith(".wasm"));
    const webSignals = this.findWebSignals(paths);
    const releaseAssets = releases.flatMap(release => (release.assets ?? []).map(asset => asset.name));

    const hasManifest = lower.some(path => /(^|\/)(manifest\.json|manifest\.webmanifest)$/.test(path));
    const hasIndex = lower.some(path => /(^|\/)index\.html$/.test(path));
    const hasPackageJson = lower.some(path => /(^|\/)package\.json$/.test(path));
    const hasOqerunMetadata = lower.some(path => /(^|\/)(oqerun\.json|oqpkg\.json)$/.test(path));
    const hasServiceWorker = lower.some(path => /(^|\/)(service-worker|sw)(\.[a-z0-9._-]+)?$/.test(path));
    const hasBuildConfig = lower.some(path => /(^|\/)(vite|webpack|rollup|parcel|astro|next|nuxt|svelte|angular)\.config\.[a-z0-9]+$/.test(path));
    const hasNativeOnly = lower.some(path => /\.(exe|msi|dmg|pkg|deb|rpm|apk|appimage)$/.test(path));

    const detectedType = this.detectType({
      nativePackages,
      wasmFiles,
      hasIndex,
      hasManifest,
      hasPackageJson,
      hasOqerunMetadata,
      hasServiceWorker,
      hasBuildConfig,
      hasNativeOnly,
      liveUrl: liveUrl ?? repo.homepage ?? undefined
    });

    const targetUrl = this.normaliseLiveUrl(liveUrl || repo.homepage || this.inferGitHubPagesUrl(repo.full_name));
    const live = targetUrl ? await this.checkLiveUrl(targetUrl) : { status: "not-provided" as const };

    const checks: ScanCheck[] = [];
    const notes: string[] = [];

    checks.push({
      label: "Public repository",
      status: "pass",
      detail: repo.html_url
    });

    checks.push({
      label: "Open-source license",
      status: repo.license?.spdx_id ? "pass" : "warn",
      detail: repo.license?.spdx_id || "No SPDX license detected by GitHub."
    });

    checks.push({
      label: "README",
      status: lower.some(path => /(^|\/)readme(?:\.[^/]+)?$/.test(path)) ? "pass" : "warn",
      detail: lower.some(path => /(^|\/)readme(?:\.[^/]+)?$/.test(path)) ? "README found." : "No README file found."
    });

    checks.push({
      label: "Oqerun package",
      status: nativePackages.length ? "pass" : "info",
      detail: nativePackages.length ? nativePackages.slice(0, 5).join(", ") : "No .oqpkg package found."
    });

    checks.push({
      label: "Browser application",
      status: detectedType === "web" || detectedType === "pwa" ? "pass" : detectedType === "wasm" ? "info" : hasIndex || hasManifest || hasPackageJson ? "warn" : "fail",
      detail: detectedType === "web" || detectedType === "pwa" ? "Browser-compatible project signals detected." : hasIndex || hasManifest || hasPackageJson ? "Some web signals were detected, but runtime compatibility needs review." : "No clear browser application entry point detected."
    });

    checks.push({
      label: "WebAssembly",
      status: wasmFiles.length ? "pass" : "info",
      detail: wasmFiles.length ? wasmFiles.slice(0, 5).join(", ") : "No .wasm files detected."
    });

    checks.push({
      label: "Release assets",
      status: releaseAssets.length ? "pass" : "info",
      detail: releaseAssets.length ? releaseAssets.slice(0, 8).join(", ") : "No published release assets detected."
    });

    if (targetUrl) {
      checks.push({
        label: "Live web test",
        status: live.status === "verified" ? "pass" : "warn",
        detail: live.status === "verified" ? "The supplied/inferred URL responded as a web page." : live.status === "unverified" ? live.detail : "No live URL was available."
      });
    } else {
      checks.push({ label: "Live web test", status: "warn", detail: "No live HTTPS URL was provided or inferred." });
    }

    if (tree.truncated) {
      notes.push("GitHub returned a truncated repository tree. The scan is incomplete and requires maintainer review.");
    }
    if (repo.archived) {
      notes.push("The repository is archived.");
    }
    if (!repo.license?.spdx_id) {
      notes.push("A public repository without a detected open-source license should not be published as an open-source listing until the license is clarified.");
    }

    let recommendation: SubmissionStatus;
    if (nativePackages.length) recommendation = "native";
    else if (detectedType === "pwa" || detectedType === "web" || detectedType === "wasm") recommendation = live.status === "verified" ? "web" : "needs-review";
    else if (hasNativeOnly) recommendation = "not-compatible";
    else recommendation = "needs-review";

    if (tree.truncated) recommendation = "needs-review";

    return {
      repository: repo.full_name,
      repositoryUrl: repo.html_url,
      name: repo.name,
      description: repo.description ?? "",
      homepage: repo.homepage || undefined,
      license: repo.license?.spdx_id || repo.license?.name || "Unknown",
      branch: repo.default_branch,
      archived: repo.archived,
      filesScanned: entries.length,
      nativePackages,
      webSignals,
      wasmFiles,
      releaseAssets,
      liveUrl: targetUrl,
      liveStatus: live.status,
      detectedType,
      recommendation,
      checks,
      notes,
      scannedAt: new Date().toISOString()
    };
  }

  private detectType(input: {
    nativePackages: string[];
    wasmFiles: string[];
    hasIndex: boolean;
    hasManifest: boolean;
    hasPackageJson: boolean;
    hasOqerunMetadata: boolean;
    hasServiceWorker: boolean;
    hasBuildConfig: boolean;
    hasNativeOnly: boolean;
    liveUrl?: string;
  }): SubmissionReport["detectedType"] {
    if (input.nativePackages.length) return "oqpkg";
    if (input.wasmFiles.length && (input.hasIndex || input.hasManifest || Boolean(input.liveUrl))) return "wasm";
    if (input.hasManifest && (input.hasIndex || input.hasServiceWorker || Boolean(input.liveUrl))) return "pwa";
    if (input.hasIndex || input.hasPackageJson || input.hasBuildConfig || Boolean(input.liveUrl)) return "web";
    if (input.hasOqerunMetadata) return "oqpkg";
    if (input.hasNativeOnly) return "external";
    return "unknown";
  }

  private findWebSignals(paths: string[]): string[] {
    const patterns = [
      /(^|\/)index\.html$/i,
      /(^|\/)(manifest\.json|manifest\.webmanifest)$/i,
      /(^|\/)package\.json$/i,
      /(^|\/)(service-worker|sw)(\.[a-z0-9._-]+)?$/i,
      /(^|\/)(vite|webpack|rollup|parcel|astro|next|nuxt|svelte|angular)\.config\.[a-z0-9]+$/i,
      /\.(html|css|js|jsx|ts|tsx|webmanifest)$/i
    ];
    const found: string[] = [];
    for (const path of paths) {
      if (patterns.some(pattern => pattern.test(path))) {
        found.push(path);
        if (found.length >= 20) break;
      }
    }
    return found;
  }

  private parseRepositoryUrl(value: string): { owner: string; name: string } {
    let url: URL;
    try {
      url = new URL(value.trim());
    } catch {
      throw new Error("Enter a valid GitHub repository URL.");
    }

    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com") {
      throw new Error("The repository must be a public https://github.com/OWNER/REPOSITORY URL.");
    }

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) throw new Error("Enter a complete GitHub repository URL.");

    const owner = parts[0].replace(/\.git$/i, "");
    const name = parts[1].replace(/\.git$/i, "");
    if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(name)) {
      throw new Error("The GitHub repository URL contains invalid characters.");
    }
    return { owner, name };
  }

  private normaliseLiveUrl(value?: string): string | undefined {
    if (!value) return undefined;
    try {
      const url = new URL(value.trim());
      if (url.protocol !== "https:") return undefined;
      if (url.hostname === "localhost" || url.hostname.endsWith(".local") || /^127\.|^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[0-1])\./.test(url.hostname)) return undefined;
      return url.toString();
    } catch {
      return undefined;
    }
  }

  private inferGitHubPagesUrl(fullName: string): string | undefined {
    const [owner, repo] = fullName.split("/");
    if (!owner || !repo) return undefined;
    return "https://" + owner + ".github.io/" + repo + "/";
  }

  private async checkLiveUrl(url: string): Promise<{ status: "verified" | "unverified"; detail: string }> {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        credentials: "omit",
        signal: controller.signal,
        headers: { Accept: "text/html,application/xhtml+xml" }
      });
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok) return { status: "unverified", detail: "Live URL returned HTTP " + response.status + "." };
      if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
        return { status: "unverified", detail: "Live URL responded, but not as an HTML page (" + contentType + ")." };
      }
      return { status: "verified", detail: "Live URL responded with HTTP " + response.status + "." };
    } catch {
      return { status: "unverified", detail: "The browser could not verify the live URL. The site may block cross-origin requests; maintainer review is required." };
    } finally {
      window.clearTimeout(timer);
    }
  }

  private async github<T>(path: string): Promise<T> {
    const response = await fetch(this.api + path, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10"
      }
    });

    if (response.status === 403) throw new Error("GitHub API rate limit reached. Please wait and try the scan again.");
    if (response.status === 404) throw new Error("GitHub repository or resource was not found. Make sure the repository is public.");
    if (!response.ok) throw new Error("GitHub returned HTTP " + response.status + ".");
    return response.json() as Promise<T>;
  }
}
