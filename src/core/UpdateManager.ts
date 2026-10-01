import type { Application } from "../models/App";
import type { InstalledApplication } from "./AppRegistry";

function compareVersions(a: string, b: string): number {
  const left = a.split(".").map((x) => Number.parseInt(x, 10) || 0);
  const right = b.split(".").map((x) => Number.parseInt(x, 10) || 0);

  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const l = left[i] ?? 0;
    const r = right[i] ?? 0;
    if (l !== r) return l > r ? 1 : -1;
  }

  return 0;
}

export class UpdateManager {
  findUpdates(installed: InstalledApplication[], catalog: Application[]): Application[] {
    return installed
      .map((item) => catalog.find((app) => app.id === item.id))
      .filter((app): app is Application => Boolean(app))
      .filter((app) => {
        const current = installed.find((item) => item.id === app.id);
        return Boolean(current && compareVersions(app.version, current.version) > 0);
      });
  }
}
