import type { Application } from "../models/App";

interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
  content_type?: string;
  size?: number;
  digest?: string | null;
}

interface GitHubRelease {
  tag_name?: string;
  html_url?: string;
  zipball_url?: string;
  assets?: GitHubReleaseAsset[];
}

export interface DownloadTarget {
  url: string;
  fileName: string;
  source: "declared" | "github-release" | "github-source";
  version?: string;
  sha256?: string;
}

const RELEASE_EXTENSIONS = [
  ".oqpkg", ".wasm", ".zip", ".tar.gz", ".tgz", ".webmanifest", ".json", ".html"
];

export class DownloadManager {
  private readonly cache = new Map<string, DownloadTarget | null>();

  async resolve(app: Application): Promise<DownloadTarget | null> {
    const cached = this.cache.get(app.id);
    if (cached !== undefined) return cached;

    if (app.installation.downloadUrl) {
      const target = {
        url: app.installation.downloadUrl,
        fileName: app.installation.downloadFileName ?? this.fileName(app.name, app.version),
        source: "declared" as const,
        version: app.version,
        sha256: app.installation.sha256
      };
      this.cache.set(app.id, target);
      return target;
    }

    if (app.source.type === "github" && app.source.repository) {
      const target = await this.resolveGitHub(app.source.repository, app);
      this.cache.set(app.id, target);
      return target;
    }

    this.cache.set(app.id, null);
    return null;
  }

  async download(app: Application): Promise<DownloadTarget> {
    const target = await this.resolve(app);
    if (!target) {
      throw new Error("No compatible downloadable release was published by this project.");
    }

    window.open(target.url, "_blank", "noopener,noreferrer");
    return target;
  }

  private async resolveGitHub(repository: string, app: Application): Promise<DownloadTarget | null> {
    const encoded = repository.split("/").map(encodeURIComponent).join("/");
    try {
      const response = await fetch("https://api.github.com/repos/" + encoded + "/releases/latest", {
        headers: { Accept: "application/vnd.github+json" }
      });

      if (response.ok) {
        const release = await response.json() as GitHubRelease;
        const assets = (release.assets ?? []).filter(asset =>
          RELEASE_EXTENSIONS.some(ext => asset.name.toLowerCase().endsWith(ext))
        );

        const preferred = this.preferredAsset(assets, app) ?? assets[0];
        if (preferred?.browser_download_url) {
          return {
            url: preferred.browser_download_url,
            fileName: preferred.name,
            source: "github-release",
            version: release.tag_name ?? app.version,
            sha256: preferred.digest?.startsWith("sha256:") ? preferred.digest.slice(7) : undefined
          };
        }

        if (release.zipball_url) {
          return {
            url: release.zipball_url,
            fileName: repository.split("/").pop() + "-" + (release.tag_name ?? app.version) + ".zip",
            source: "github-source",
            version: release.tag_name ?? app.version
          };
        }
      }

      const repoResponse = await fetch("https://api.github.com/repos/" + encoded, {
        headers: { Accept: "application/vnd.github+json" }
      });
      if (!repoResponse.ok) return null;

      const repoInfo = await repoResponse.json() as { default_branch?: string };
      const branch = repoInfo.default_branch || "main";
      return {
        url: "https://github.com/" + repository + "/archive/refs/heads/" + encodeURIComponent(branch) + ".zip",
        fileName: repository.split("/").pop() + "-" + branch + ".zip",
        source: "github-source",
        version: app.version
      };
    } catch {
      return null;
    }
  }

  private preferredAsset(assets: GitHubReleaseAsset[], app: Application): GitHubReleaseAsset | undefined {
    const typeOrder = app.type === "wasm"
      ? [".wasm", ".zip", ".tar.gz", ".tgz"]
      : [".oqpkg", ".zip", ".tar.gz", ".tgz", ".wasm", ".html", ".webmanifest", ".json"];
    for (const ext of typeOrder) {
      const match = assets.find(asset => asset.name.toLowerCase().endsWith(ext));
      if (match) return match;
    }
    return undefined;
  }

  private fileName(name: string, version: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + version + ".download";
  }
}
