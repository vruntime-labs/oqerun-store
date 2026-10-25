import type { Application } from "../models/App";
import { permissionDefinitions } from "../models/Permission";

export interface OqerunInstallationRequest {
  appId: string;
  name: string;
  version: string;
  type: Application["type"];
  sourceUrl?: string;
  iconUrl?: string;
  sha256?: string;
  permissions: string[];
  fileAssociations: string[];
}

export interface OqerunInstallationBridgeApi {
  apiVersion: string;
  install(request: OqerunInstallationRequest): Promise<void>;
}

const OQERUN_OS_ORIGIN = "https://vruntime-labs.github.io";

export class InstallationBridge {
  private available = false;
  private readonly pending = new Map<string, (result: { ok: boolean; error?: string }) => void>();

  constructor() {
    window.addEventListener("message", this.onMessage);
    if (window.parent !== window) {
      // The Store is embedded by Oqerun OS. The parent origin can be
      // GitHub Pages, Vercel, or another official Oqerun deployment, so
      // the probe must target the actual parent rather than a hard-coded OS URL.
      window.parent.postMessage(
        { type: "oqerun-installation-probe", apiVersion: "1.0" },
        OQERUN_OS_ORIGIN
      );
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  async install(app: Application): Promise<void> {
    if (window.parent === window) {
      throw new Error("Open this Store inside Oqerun OS to install apps directly into Oqerun.");
    }

    const knownPermissions = new Set(permissionDefinitions.map(permission => permission.id));
    const unknownPermissions = app.permissions.filter(permission => !knownPermissions.has(permission));
    if (unknownPermissions.length) {
      throw new Error("Installation blocked: this app requests unknown permissions (" + unknownPermissions.slice(0, 5).join(", ") + ").");
    }
    if (app.type === "oqpkg" && !/^[a-f0-9]{64}$/i.test(app.installation.sha256 ?? "")) {
      throw new Error("Native package installation requires a published SHA-256 digest. No package was installed.");
    }

    const requestId =
      "oq-install-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2);

    const request: OqerunInstallationRequest & { requestId: string } = {
      requestId,
      appId: app.id,
      name: app.name,
      version: app.version,
      type: app.type,
      sourceUrl: app.installation.url,
      iconUrl: app.metadata?.iconUrl ?? app.icon,
      sha256: app.installation.sha256,
      permissions: [...app.permissions],
      fileAssociations: [...(app.fileAssociations ?? [])]
    };

    const result = new Promise<{ ok: boolean; error?: string }>((resolve) => {
      this.pending.set(requestId, resolve);
    });

    window.parent.postMessage(
      {
        ...request,
        type: "oqerun-installation-request"
      },
      OQERUN_OS_ORIGIN
    );

    let timeoutId = 0;
    const timeout = new Promise<{ ok: boolean; error?: string }>((resolve) => {
      timeoutId = window.setTimeout(
        () => resolve({ ok: false, error: "Oqerun OS did not respond to the installation request." }),
        30000
      );
    });

    const response = await Promise.race([result, timeout]);
    window.clearTimeout(timeoutId);
    this.pending.delete(requestId);

    if (!response.ok) {
      throw new Error(response.error ?? "Installation failed.");
    }
  }

  private onMessage = (event: MessageEvent): void => {
    if (event.origin !== OQERUN_OS_ORIGIN || event.source !== window.parent) return;
    if (!event.data || typeof event.data !== "object") return;

    const data = event.data as {
      type?: string;
      requestId?: string;
      apiVersion?: string;
      result?: "ok" | "error";
      error?: string;
    };

    if (data?.type === "oqerun-installation-ready" && data.apiVersion === "1.0") {
      this.available = true;
      return;
    }

    if (
      data?.type !== "oqerun-installation-response" ||
      typeof data.requestId !== "string" ||
      !["ok", "error"].includes(data.result ?? "")
    ) {
      return;
    }

    const resolve = this.pending.get(data.requestId);
    if (!resolve) return;

    resolve({
      ok: data.result === "ok",
      error: typeof data.error === "string" ? data.error.slice(0, 300) : undefined
    });
  };
}
