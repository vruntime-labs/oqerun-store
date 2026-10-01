export type UpdateMode = "manual" | "auto";
export type ThemeMode = "system" | "dark" | "light";

export interface StoreSettings {
  updates: { mode: UpdateMode };
  theme: ThemeMode;
  confirmInstall: boolean;
  updateNotifications: boolean;
  anonymousUsageStats: boolean;
}

const STORAGE_KEY = "oqerun-store-settings";

const DEFAULT_SETTINGS: StoreSettings = {
  updates: { mode: "manual" },
  theme: "system",
  confirmInstall: true,
  updateNotifications: true,
  anonymousUsageStats: false
};

export class UpdateSettingsManager {
  private settings: StoreSettings = this.load();

  get(): StoreSettings {
    return JSON.parse(JSON.stringify(this.settings)) as StoreSettings;
  }

  isAuto(): boolean {
    return this.settings.updates.mode === "auto";
  }

  setMode(mode: UpdateMode): void {
    this.settings.updates.mode = mode;
    this.save();
  }

  set<K extends keyof StoreSettings>(key: K, value: StoreSettings[K]): void {
    this.settings[key] = value;
    this.save();
  }

  private load(): StoreSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as StoreSettings;
      const parsed = JSON.parse(raw) as Partial<StoreSettings>;
      return {
        updates: { mode: parsed.updates?.mode === "auto" ? "auto" : "manual" },
        theme: parsed.theme === "light" || parsed.theme === "dark" ? parsed.theme : "system",
        confirmInstall: parsed.confirmInstall !== false,
        updateNotifications: parsed.updateNotifications !== false,
        anonymousUsageStats: parsed.anonymousUsageStats === true
      };
    } catch {
      return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as StoreSettings;
    }
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
  }
}
