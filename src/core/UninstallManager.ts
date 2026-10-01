import type { Application } from "../models/App";

export class UninstallManager {
  async uninstall(app: Application): Promise<void> {
    if (app.type === "oqpkg") {
      throw new Error("Native .oqpkg removal requires the Oqerun OS installation bridge.");
    }

    if ((app.type === "pwa" || app.type === "web") && app.installation.url && "caches" in window) {
      const origin = new URL(app.installation.url).origin;
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.toLowerCase().includes(origin.replace(/[^a-z0-9]+/gi, "-").toLowerCase()))
          .map((key) => caches.delete(key))
      );
    }
  }
}
