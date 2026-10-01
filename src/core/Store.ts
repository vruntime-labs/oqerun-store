import { Catalog } from "../catalog/Catalog";
import { catalogData } from "../data/catalog";
import { InstallManager } from "./InstallManager";
import { AppRegistry } from "./AppRegistry";
import { Compatibility } from "./Compatibility";
import { PermissionManager } from "./PermissionManager";
import { Verification } from "./Verification";
import { UpdateManager } from "./UpdateManager";
import { UpdateSettingsManager, type UpdateMode } from "./UpdateSettings";
import { OqpkgProvider } from "../providers/OqpkgProvider";
import { PwaProvider } from "../providers/PwaProvider";
import { WebAppProvider } from "../providers/WebAppProvider";
import { WasmProvider } from "../providers/WasmProvider";
import { ExternalProvider } from "../providers/ExternalProvider";
import type { Application } from "../models/App";

export class Store {
  private readonly catalog = new Catalog(catalogData);
  private readonly registry = new AppRegistry();
  private readonly verifier = new Verification();
  private readonly permissions = new PermissionManager();
  private readonly updates = new UpdateManager();
  private readonly updateSettings = new UpdateSettingsManager();
  private readonly installer = new InstallManager([
    new OqpkgProvider(),
    new PwaProvider(),
    new WebAppProvider(),
    new WasmProvider(),
    new ExternalProvider()
  ]);

  private category = "All";
  private query = "";

  constructor(private readonly root: HTMLElement) {}

  private sourceUrl(app: Application): string | undefined {
    return app.source.type === "github" && app.source.repository
      ? `https://github.com/${app.source.repository}`
      : app.source.url;
  }

  private licenseUrl(app: Application): string | undefined {
    return app.source.type === "github" && app.source.repository
      ? `https://github.com/${app.source.repository}/blob/HEAD/LICENSE`
      : undefined;
  }

  private listingLabel(app: Application): string {
    return app.listing === "official" ? "Official Oqerun app" : "Community app";
  }

  render(): void {
    this.root.innerHTML = `
      <div class="store-shell">
        <header class="topbar">
          <div class="brand"><div class="brand-mark">O</div><div><strong>Oqerun Store</strong><span>Open applications for Oqerun OS</span></div></div>
          <label class="search"><span>⌕</span><input id="search" type="search" placeholder="Search applications..." /></label>
          <button class="settings-button" data-settings aria-label="Update settings">⚙</button>
        </header>
        <nav class="nav">
          <button class="nav-item active" data-home>Home</button>
          <button class="nav-item" data-category-view>Categories</button>
          <button class="nav-item" data-installed>Installed</button>
          <button class="nav-item" data-updates>Updates <b id="update-count"></b></button>
          <button class="nav-item" data-notices>Third-party notices</button>
        </nav>
        <main>
          <section class="hero"><div><p class="eyebrow">APPLICATION STORE</p><h1>Find software.<br><span>Install it simply.</span></h1><p class="hero-copy">Discover open-source applications prepared for the Oqerun ecosystem.</p></div><div class="hero-orbit"><div>O</div></div></section>
          <section class="content">
            <div class="section-heading"><div><p class="eyebrow">DISCOVER</p><h2 id="title">Featured applications</h2></div><div id="cats" class="category-list"></div></div>
            <div id="grid" class="app-grid"></div>
          </section>
        </main>
        <div id="dialog"></div>
      </div>`;
    this.bind();
    this.renderCategories();
    this.renderApps();
    this.updateCount();
    if (this.updateSettings.isAuto()) this.applyAutomaticWebUpdates();
  }

  private bind(): void {
    const search = this.root.querySelector<HTMLInputElement>("#search");
    search?.addEventListener("input", () => {
      this.query = search.value;
      this.category = "All";
      this.renderCategories();
      this.renderApps();
    });

    this.root.querySelector("[data-home]")?.addEventListener("click", () => this.showCatalog("All"));
    this.root.querySelector("[data-category-view]")?.addEventListener("click", () => this.showCatalog("All"));
    this.root.querySelector("[data-installed]")?.addEventListener("click", () => this.showInstalled());
    this.root.querySelector("[data-updates]")?.addEventListener("click", () => this.showUpdates());
    this.root.querySelector("[data-settings]")?.addEventListener("click", () => this.showSettings());
    this.root.querySelector("[data-notices]")?.addEventListener("click", () => this.showThirdPartyNotices());
  }

  private showCatalog(category: string): void {
    this.category = category;
    this.query = "";
    const search = this.root.querySelector<HTMLInputElement>("#search");
    if (search) search.value = "";
    this.renderCategories();
    this.renderApps();
  }

  private renderCategories(): void {
    const container = this.root.querySelector<HTMLDivElement>("#cats");
    if (!container) return;
    const categories = ["All", ...new Set(this.catalog.all().map((app) => app.category))];
    container.innerHTML = categories.map((category) => `<button class="category-chip ${category === this.category ? "selected" : ""}" data-category="${category}">${category}</button>`).join("");
    container.querySelectorAll<HTMLButtonElement>("[data-category]").forEach((button) => button.addEventListener("click", () => {
      this.category = button.dataset.category ?? "All";
      this.query = "";
      const search = this.root.querySelector<HTMLInputElement>("#search");
      if (search) search.value = "";
      this.renderCategories();
      this.renderApps();
    }));
  }

  private renderApps(): void {
    const grid = this.root.querySelector<HTMLDivElement>("#grid");
    const title = this.root.querySelector<HTMLHeadingElement>("#title");
    if (!grid || !title) return;

    let apps = this.query ? this.catalog.search(this.query) : this.catalog.byCategory(this.category);
    if (!this.query && this.category === "All") {
      apps = apps.filter((app) => app.featured);
      title.textContent = "Featured applications";
    } else {
      title.textContent = this.query ? "Search results" : this.category;
    }

    if (!apps.length) {
      grid.innerHTML = '<div class="empty-state"><strong>No applications found.</strong><span>Try another search or category.</span></div>';
      return;
    }

    grid.innerHTML = apps.map((app) => this.card(app)).join("");
    grid.querySelectorAll<HTMLButtonElement>("[data-install]").forEach((button) => button.addEventListener("click", () => {
      const app = this.catalog.find(button.dataset.install ?? "");
      if (app) void this.install(app);
    }));
    grid.querySelectorAll<HTMLButtonElement>("[data-update]").forEach((button) => button.addEventListener("click", () => {
      const app = this.catalog.find(button.dataset.update ?? "");
      if (app) void this.update(app);
    }));
    grid.querySelectorAll<HTMLButtonElement>("[data-details]").forEach((button) => button.addEventListener("click", () => {
      const app = this.catalog.find(button.dataset.details ?? "");
      if (app) this.details(app);
    }));
  }

  private card(app: Application): string {
    const installed = this.registry.get(app.id);
    const update = installed ? this.updates.findUpdates([installed], [app])[0] : undefined;
    let action = `<button class="install-button" data-install="${app.id}">Install</button>`;

    if (update) {
      action = `<button class="install-button update-button" data-update="${app.id}">Update to ${app.version}</button>`;
    } else if (installed) {
      action = `<button class="install-button" data-details="${app.id}">Installed · ${installed.version}</button>`;
    }

    const listingBadge = app.listing === "official"
      ? '<span class="listing-badge official">Official</span>'
      : '<span class="listing-badge community">Community</span>';
    const verifiedBadge = app.publisher.verified ? '<span class="verified">✓ Publisher verified</span>' : "";

    return `<article class="app-card">
      <button class="app-icon" data-details="${app.id}">${app.icon}</button>
      <div class="app-card-body">
        <div class="app-card-title"><h3>${app.name}</h3>${listingBadge}${verifiedBadge}</div>
        <p class="publisher">${app.publisher.name} · v${app.version}</p>
        <p class="description">${app.description}</p>
        <div class="app-meta"><span>${app.category}</span><span>${app.license}</span><span>${app.type}</span></div>
        ${action}
      </div>
    </article>`;
  }

  private details(app: Application): void {
    const verification = this.verifier.verify(app);
    const known = this.permissions.validate(app.permissions);
    const unknown = this.permissions.unknown(app.permissions);
    const installed = this.registry.get(app.id);
    const update = installed ? this.updates.findUpdates([installed], [app])[0] : undefined;
    const dialog = this.root.querySelector<HTMLDivElement>("#dialog");
    if (!dialog) return;

    const action = update
      ? `<button class="install-button large" data-modal-update>Update to ${app.version}</button>`
      : `<button class="install-button large" data-modal-install>${installed ? "Installed" : "Install"}</button>`;

    dialog.innerHTML = `
      <div class="modal-backdrop"><section class="modal">
        <button class="modal-close" data-close>×</button>
        <div class="modal-icon">${app.icon}</div>
        <p class="eyebrow">${app.category} · ${app.type}</p>
        <h2>${app.name}</h2>
        <p class="modal-publisher">${app.publisher.name} · v${app.version}</p>
        <p>${app.description}</p>
        <div class="listing-notice ${app.listing === "community" ? "community" : "official"}">
          <strong>${this.listingLabel(app)}</strong>
          <span>${app.listing === "community"
            ? "Listed by Oqerun Store as a third-party project. The original project, publisher and license remain separate from Oqerun."
            : "Published by VRuntime Labs for the Oqerun ecosystem."}</span>
        </div>
        <div class="details-grid">
          <span>Publisher<strong>${app.publisher.name}</strong></span>
          <span>License<strong>${app.license}</strong></span>
          <span>Oqerun<strong>${app.compatibility.minimumOqerunVersion}+</strong></span>
          <span>Type<strong>${app.type}</strong></span>
          <span>Source<strong>${app.source.repository ?? app.source.url ?? "Not listed"}</strong></span>
          <span>Permissions<strong>${known.length ? known.join(", ") : "None listed"}${unknown.length ? ` (unknown: ${unknown.join(", ")})` : ""}</strong></span>
        </div>
        <div class="source-links">
          ${this.sourceUrl(app) ? `<a href="${this.sourceUrl(app)}" target="_blank" rel="noopener noreferrer">Original source ↗</a>` : ""}
          ${this.licenseUrl(app) ? `<a href="${this.licenseUrl(app)}" target="_blank" rel="noopener noreferrer">License ↗</a>` : ""}
        </div>
        ${verification.warnings.map((warning) => `<p class="store-warning">⚠ ${warning}</p>`).join("")}
        ${verification.errors.map((error) => `<p class="store-error">✕ ${error}</p>`).join("")}
        ${update ? `<p class="store-update">Update available: v${update.currentVersion} → v${update.availableVersion}</p>` : ""}
        ${action}
      </section></div>`;

    dialog.querySelector("[data-close]")?.addEventListener("click", () => dialog.innerHTML = "");
    dialog.querySelector("[data-modal-install]")?.addEventListener("click", () => void this.install(app));
    dialog.querySelector("[data-modal-update]")?.addEventListener("click", () => void this.update(app));
  }

  private async install(app: Application): Promise<void> {
    const verification = this.verifier.verify(app);
    if (!verification.valid) {
      this.notice(verification.errors.join(" "));
      return;
    }

    if (!Compatibility.meetsMinimum("0.1.0", app.compatibility.minimumOqerunVersion)) {
      this.notice(`This application requires Oqerun ${app.compatibility.minimumOqerunVersion} or newer.`);
      return;
    }

    try {
      await this.installer.install(app);
      this.registry.register(app);
      this.updateCount();
      this.renderApps();
    } catch (error) {
      this.notice(error instanceof Error ? error.message : "Installation could not be started.");
    }
  }

  private async update(app: Application): Promise<void> {
    const installed = this.registry.get(app.id);
    if (!installed) {
      await this.install(app);
      return;
    }

    if (app.type === "web" || app.type === "pwa") {
      if (!app.installation.url) {
        this.notice("This web application has no update URL.");
        return;
      }

      const updateUrl = new URL(app.installation.url, window.location.href);
      updateUrl.searchParams.set("oqerun-update", Date.now().toString());
      window.open(updateUrl.toString(), "_blank", "noopener,noreferrer");
      this.registry.register(app);
      this.updateCount();
      this.renderApps();
      this.notice(`${app.name} is available at the latest deployed version. The Store opened it with a fresh update request.`);
      return;
    }

    try {
      await this.installer.install(app);
      this.registry.register(app);
      this.updateCount();
      this.renderApps();
    } catch (error) {
      this.notice(error instanceof Error ? error.message : "This application cannot be updated from the standalone Store yet.");
    }
  }

  private showThirdPartyNotices(): void {
    const communityApps = this.catalog.all().filter((app) => app.listing === "community");
    const dialog = this.root.querySelector<HTMLDivElement>("#dialog");
    if (!dialog) return;

    dialog.innerHTML = `
      <div class="modal-backdrop"><section class="modal notices-modal">
        <button class="modal-close" data-close>×</button>
        <p class="eyebrow">THIRD-PARTY NOTICES</p>
        <h2>Community applications</h2>
        <p class="notices-intro">
          These applications are independent open-source projects listed by Oqerun Store.
          Oqerun Store does not claim ownership of their code, branding or intellectual property.
          Each project remains governed by its own license.
        </p>
        <div class="notice-list">
          ${communityApps.map((app) => {
            const source = this.sourceUrl(app);
            return `<article class="notice-item">
              <div><strong>${app.name}</strong><span>${app.publisher.name} · ${app.license}</span></div>
              ${source ? `<a href="${source}" target="_blank" rel="noopener noreferrer">Source ↗</a>` : ""}
            </article>`;
          }).join("")}
        </div>
        <p class="notices-footer">For license questions or listing corrections, contact the original project maintainer through the project's official repository.</p>
        <button class="install-button large" data-close>Close</button>
      </section></div>`;

    dialog.querySelectorAll("[data-close]").forEach((element) =>
      element.addEventListener("click", () => dialog.innerHTML = "")
    );
  }

  private showInstalled(): void {
    const installed = this.registry.list();
    const dialog = this.root.querySelector<HTMLDivElement>("#dialog");
    if (!dialog) return;

    if (!installed.length) {
      this.notice("No applications are registered as installed on this standalone Store yet. Native installation will be managed by Oqerun OS.");
      return;
    }

    dialog.innerHTML = `<div class="modal-backdrop"><section class="modal"><button class="modal-close" data-close>×</button><p class="eyebrow">INSTALLED</p><h2>Installed applications</h2>${installed.map((item) => {
      const app = this.catalog.find(item.id);
      const update = app ? this.updates.findUpdates([item], [app])[0] : undefined;
      return `<div class="installed-row"><strong>${item.name}</strong><span>v${item.version}${update ? ` → v${update.availableVersion}` : ""}</span></div>`;
    }).join("")}</section></div>`;
    dialog.querySelector("[data-close]")?.addEventListener("click", () => dialog.innerHTML = "");
  }

  private showUpdates(): void {
    const updates = this.updates.findUpdates(this.registry.list(), this.catalog.all());
    const dialog = this.root.querySelector<HTMLDivElement>("#dialog");
    if (!dialog) return;

    if (!updates.length) {
      this.notice("No updates are available.");
      return;
    }

    dialog.innerHTML = `
      <div class="modal-backdrop"><section class="modal">
        <button class="modal-close" data-close>×</button>
        <p class="eyebrow">UPDATES</p>
        <h2>Available updates</h2>
        <p>Update mode: <strong>${this.updateSettings.get().mode === "auto" ? "Automatic" : "Manual"}</strong></p>
        <div class="update-list">${updates.map((update) => `
          <div class="update-row">
            <div><strong>${update.app.name}</strong><span>v${update.currentVersion} → v${update.availableVersion}</span></div>
            <button class="install-button small" data-update="${update.app.id}">Update</button>
          </div>`).join("")}</div>
      </section></div>`;

    dialog.querySelector("[data-close]")?.addEventListener("click", () => dialog.innerHTML = "");
    dialog.querySelectorAll<HTMLButtonElement>("[data-update]").forEach((button) => {
      const app = this.catalog.find(button.dataset.update ?? "");
      if (app) button.addEventListener("click", () => void this.update(app));
    });
  }

  private showSettings(): void {
    const mode = this.updateSettings.get().mode;
    const dialog = this.root.querySelector<HTMLDivElement>("#dialog");
    if (!dialog) return;

    dialog.innerHTML = `
      <div class="modal-backdrop"><section class="modal compact">
        <button class="modal-close" data-close>×</button>
        <p class="eyebrow">STORE SETTINGS</p>
        <h2>Application updates</h2>
        <p>Choose how Oqerun Store handles available application updates.</p>
        <div class="update-mode-list">
          <button class="mode-option ${mode === "manual" ? "selected" : ""}" data-mode="manual">
            <strong>Manual updates</strong><span>Show available updates and let you choose when to apply them.</span>
          </button>
          <button class="mode-option ${mode === "auto" ? "selected" : ""}" data-mode="auto">
            <strong>Automatic updates</strong><span>Automatically synchronize web and PWA entries with the Store catalog. Native packages remain controlled by Oqerun OS.</span>
          </button>
        </div>
      </section></div>`;

    dialog.querySelector("[data-close]")?.addEventListener("click", () => dialog.innerHTML = "");
    dialog.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => button.addEventListener("click", () => {
      const selected = button.dataset.mode as UpdateMode;
      this.updateSettings.setMode(selected);
      dialog.innerHTML = "";
      this.updateCount();
      this.renderApps();
      if (selected === "auto") void this.applyAutomaticWebUpdates();
      this.notice(selected === "auto" ? "Automatic updates are enabled." : "Manual updates are enabled.");
    }));
  }

  private async applyAutomaticWebUpdates(): Promise<void> {
    const updates = this.updates.findUpdates(this.registry.list(), this.catalog.all());
    const webUpdates = updates.filter((item) => item.app.type === "web" || item.app.type === "pwa");

    for (const update of webUpdates) {
      this.registry.register(update.app);
    }

    if (webUpdates.length) {
      this.updateCount();
      this.renderApps();
    }
  }

  private updateCount(): void {
    const count = this.root.querySelector<HTMLElement>("#update-count");
    if (!count) return;
    const updates = this.updates.findUpdates(this.registry.list(), this.catalog.all());
    count.textContent = updates.length ? `· ${updates.length}` : "";
  }

  private notice(message: string): void {
    const dialog = this.root.querySelector<HTMLDivElement>("#dialog");
    if (!dialog) return;
    dialog.innerHTML = `<div class="modal-backdrop"><section class="modal compact"><button class="modal-close" data-close>×</button><div class="notice-icon">!</div><h2>Store notice</h2><p>${message}</p><button class="install-button large" data-close>Close</button></section></div>`;
    dialog.querySelectorAll("[data-close]").forEach((element) => element.addEventListener("click", () => dialog.innerHTML = ""));
  }
}
