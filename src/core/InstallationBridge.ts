import type { Application } from "../models/App";

export interface OqerunInstallationRequest {
  appId: string;
  name: string;
  version: string;
  type: Application["type"];
  sourceUrl?: string;
  sha256?: string;
  permissions: string[];
  fileAssociations: string[];
}

export interface OqerunInstallationBridgeApi {
  apiVersion: string;
  install(request: OqerunInstallationRequest): Promise<void>;
}

declare global {
  interface Window {
    oqerun?: {
      installationBridge?: OqerunInstallationBridgeApi;
    };
  }
}

export class InstallationBridge {
  isAvailable(): boolean {
    return typeof window !== "undefined" &&
      typeof window.oqerun?.installationBridge?.install === "function";
  }

  async install(app: Application): Promise<void> {
    const bridge = window.oqerun?.installationBridge;
    if (!bridge?.install) {
      throw new Error("Native installation is available only when Oqerun OS provides the installation bridge.");
    }

    await bridge.install({
      appId: app.id,
      name: app.name,
      version: app.version,
      type: app.type,
      sourceUrl: app.installation.url,
      sha256: app.installation.sha256,
      permissions: [...app.permissions],
      fileAssociations: [...(app.fileAssociations ?? [])]
    });
  }
}
