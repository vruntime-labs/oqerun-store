import type { Application } from "../models/App";

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
      "*"
    );

    const timeout = new Promise<{ ok: boolean; error?: string }>((resolve) => {
      window.setTimeout(
        () => resolve({ ok: false, error: "Oqerun OS did not respond to the installation request." }),
        30000
      );
    });

    const response = await Promise.race([result, timeout]);
    this.pending.delete(requestId);

    if (!response.ok) {
      throw new Error(response.error ?? "Installation failed.");
    }
  }

  private onMessage = (event: MessageEvent): void => {
    if (event.origin !== OQERUN_OS_ORIGIN) return;

    const data = event.data as {
      type?: string;
      requestId?: string;
      apiVersion?: string;
      result?: "ok" | "error";
      error?: string;
    };

    if (data?.type === "oqerun-installation-ready") {
      this.available = true;
      return;
    }

    if (
      data?.type !== "oqerun-installation-response" ||
      !data.requestId
    ) {
      return;
    }

    const resolve = this.pending.get(data.requestId);
    if (!resolve) return;

    resolve({
      ok: data.result === "ok",
      error: data.error
    });
  };
}
