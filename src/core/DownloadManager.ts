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

    if (target.sha256) {
      await this.downloadAndVerify(target);
    } else {
      // Do not claim verification when a publisher has not provided a digest.
      window.open(target.url, "_blank", "noopener,noreferrer");
    }
    return target;
  }

  private async downloadAndVerify(target: DownloadTarget): Promise<void> {
    if (!/^[a-f0-9]{64}$/i.test(target.sha256 ?? "")) {
      throw new Error("The published SHA-256 digest is invalid. Download blocked.");
    }
    if (!globalThis.crypto?.subtle) {
      throw new Error("This browser cannot verify SHA-256 downloads. Use a supported secure browser.");
    }

    let response: Response;
    try {
      response = await fetch(target.url, {
        method: "GET",
        mode: "cors",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        headers: { Accept: "application/octet-stream" }
      });
    } catch {
      throw new Error("The download host does not permit a secure verification request. No file was downloaded.");
    }
    if (!response.ok || !response.body) {
      throw new Error("The file could not be fetched for verification. No file was downloaded.");
    }

    const maxBytes = 100 * 1024 * 1024;
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > maxBytes) {
      await response.body.cancel();
      throw new Error("Verified browser downloads are limited to 100 MB. No file was downloaded.");
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          throw new Error("Verified browser downloads are limited to 100 MB. No file was downloaded.");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    if (actual.toLowerCase() !== target.sha256!.toLowerCase()) {
      throw new Error("SHA-256 verification failed. The file may be altered or corrupted; download blocked.");
    }

    const blob = new Blob([bytes], { type: response.headers.get("content-type") || "application/octet-stream" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = target.fileName.replace(/[^a-z0-9._-]/gi, "_").slice(0, 180) || "verified-download";
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
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
