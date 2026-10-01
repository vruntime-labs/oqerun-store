import type { Application } from "../models/App";
import type { InstalledApplication } from "./AppRegistry";

export interface AvailableUpdate {
  app: Application;
  installed: InstalledApplication;
  currentVersion: string;
  availableVersion: string;
}

function compareVersions(a: string, b: string): number {
  const normalize = (version: string) =>
    version.replace(/^v/i, "").split(".").map((part) => Number.parseInt(part, 10) || 0);

  const left = normalize(a);
  const right = normalize(b);

  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const l = left[i] ?? 0;
    const r = right[i] ?? 0;
    if (l !== r) return l > r ? 1 : -1;
  }

  return 0;
}

export class UpdateManager {
  findUpdates(installed: InstalledApplication[], catalog: Application[]): AvailableUpdate[] {
    return installed
      .map((item) => {
        const app = catalog.find((candidate) => candidate.id === item.id);
        return app ? { app, installed: item } : undefined;
      })
      .filter((item): item is { app: Application; installed: InstalledApplication } => Boolean(item))
      .filter(({ app, installed }) => compareVersions(app.version, installed.version) > 0)
      .map(({ app, installed }) => ({
        app,
        installed,
        currentVersion: installed.version,
        availableVersion: app.version
      }));
  }
}
