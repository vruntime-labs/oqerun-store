export type UpdateMode = "manual" | "auto";

export interface UpdateSettings {
  mode: UpdateMode;
}

const STORAGE_KEY = "oqerun-store-update-settings";

export class UpdateSettingsManager {
  private settings: UpdateSettings = this.load();

  get(): UpdateSettings {
    return { ...this.settings };
  }

  isAuto(): boolean {
    return this.settings.mode === "auto";
  }

  setMode(mode: UpdateMode): void {
    this.settings = { mode };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
  }

  private load(): UpdateSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { mode: "manual" };
      const parsed = JSON.parse(raw) as Partial<UpdateSettings>;
      return parsed.mode === "auto" ? { mode: "auto" } : { mode: "manual" };
    } catch {
      return { mode: "manual" };
    }
  }
}
