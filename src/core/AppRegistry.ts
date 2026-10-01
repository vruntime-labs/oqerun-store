import type { Application } from "../models/App";

export interface InstalledApplication {
  id: string;
  name: string;
  version: string;
  installedAt: string;
  updatedAt: string;
  sourceType: Application["type"];
  installMethod: Application["installation"]["method"];
  sizeBytes?: number;
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
    const now = new Date().toISOString();
    const record: InstalledApplication = {
      id: app.id,
      name: app.name,
      version: app.version,
      installedAt: existing?.installedAt ?? now,
      updatedAt: now,
      sourceType: app.type,
      installMethod: app.installation.method,
      sizeBytes: app.metadata?.sizeBytes
    };

    this.installed = [...this.installed.filter((item) => item.id !== app.id), record];
    this.save();
  }

  unregister(id: string): void {
    this.installed = this.installed.filter((app) => app.id !== id);
    this.save();
  }

  totalSize(): number {
    return this.installed.reduce((sum, app) => sum + (app.sizeBytes ?? 0), 0);
  }

  private load(): InstalledApplication[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as InstalledApplication[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.installed));
  }
}
