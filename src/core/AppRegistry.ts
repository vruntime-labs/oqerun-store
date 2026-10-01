import type { Application } from "../models/App";

export interface InstalledApplication {
  id: string;
  name: string;
  version: string;
  installedAt: string;
  sourceType: Application["type"];
}

const STORAGE_KEY = "oqerun-store-installed-apps";

export class AppRegistry {
  private installed: InstalledApplication[] = this.load();

  list(): InstalledApplication[] {
    return [...this.installed];
  }

  get(id: string): InstalledApplication | undefined {
    return this.installed.find((app) => app.id === id);
  }

  isInstalled(id: string): boolean {
    return Boolean(this.get(id));
  }

  register(app: Application): void {
    const existing = this.get(app.id);
    const record: InstalledApplication = {
      id: app.id,
      name: app.name,
      version: app.version,
      installedAt: existing?.installedAt ?? new Date().toISOString(),
      sourceType: app.type
    };

    this.installed = [
      ...this.installed.filter((item) => item.id !== app.id),
      record
    ];
    this.save();
  }

  unregister(id: string): void {
    this.installed = this.installed.filter((app) => app.id !== id);
    this.save();
  }

  private load(): InstalledApplication[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as InstalledApplication[]) : [];
    } catch {
      return [];
    }
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.installed));
  }
}
