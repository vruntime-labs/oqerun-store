import { Catalog } from "../catalog/Catalog";
import { catalogData } from "../data/catalog";
import { InstallManager } from "./InstallManager";
import { AppRegistry } from "./AppRegistry";
import { Compatibility } from "./Compatibility";
import { PermissionManager } from "./PermissionManager";
import { Verification } from "./Verification";
import { UpdateManager } from "./UpdateManager";
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
  private readonly installer = new InstallManager([
    new OqpkgProvider(), new PwaProvider(), new WebAppProvider(), new WasmProvider(), new ExternalProvider()
  ]);

  private category = "All";
  private query = "";

  constructor(private readonly root: HTMLElement) {}

  render(): void {
    this.root.innerHTML = `
      <div class="store-shell">
        <header class="topbar">
          <div class="brand"><div class="brand-mark">O</div><div><strong>Oqerun Store</strong><span>Open applications for Oqerun OS</span></div></div>
          <label class="search"><span>⌕</span><input id="search" type="search" placeholder="Search applications..." /></label>
        </header>
        <nav class="nav">
          <button class="nav-item active" data-home>Home</button>
          <button class="nav-item" data-category-view>Categories</button>
          <button class="nav-item" data-installed>Installed</button>
          <button class="nav-item" data-updates>Updates <b id="update-count"></b></button>
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
    grid.querySelectorAll<HTMLButtonElement>("[data-details]").forEach((button) => button.addEventListener("click", () => {
      const app = this.catalog.find(button.dataset.details ?? "");
      if (app) this.details(app);
    }));
  }

  private card(app: Application): string {
    const installed = this.registry.get(app.id);
    const action = installed ? `<button class="install-button" data-details="${app.id}">Installed · ${installed.version}</button>` : `<button class="install-button" data-install="${app.id}">Install</button>`;
    return `<article class="app-card"><button class="app-icon" data-details="${app.id}">${app.icon}</button><div class="app-card-body"><div class="app-card-title"><h3>${app.name}</h3>${app.publisher.verified ? '<span class="verified">✓ Verified</span>' : ""}</div><p class="publisher">${app.publisher.name} · v${app.version}</p><p class="description">${app.description}</p><div class="app-meta"><span>${app.category}</span><span>${app.license}</span><span>${app.type}</span></div>${action}</div></article>`;
  }

  private details(app: Application): void {
    const verification = this.verifier.verify(app);
    const known = this.permissions.validate(app.permissions);
    const unknown = this.permissions.unknown(app.permissions);
    const dialog = this.root.querySelector<HTMLDivElement>("#dialog");
    if (!dialog) return;

    dialog.innerHTML = `
      <div class="modal-backdrop"><section class="modal">
        <button class="modal-close" data-close>×</button>
        <div class="modal-icon">${app.icon}</div>
        <p class="eyebrow">${app.category} · ${app.type}</p>
        <h2>${app.name}</h2>
        <p class="modal-publisher">${app.publisher.name} · v${app.version}</p>
        <p>${app.description}</p>
        <div class="details-grid">
          <span>License<strong>${app.license}</strong></span>
          <span>Oqerun<strong>${app.compatibility.minimumOqerunVersion}+</strong></span>
          <span>Source<strong>${app.source.repository ?? app.source.url ?? "Not listed"}</strong></span>
          <span>Permissions<strong>${known.length ? known.join(", ") : "None listed"}${unknown.length ? ` (unknown: ${unknown.join(", ")})` : ""}</strong></span>
        </div>
        ${verification.warnings.map((warning) => `<p class="store-warning">⚠ ${warning}</p>`).join("")}
        ${verification.errors.map((error) => `<p class="store-error">✕ ${error}</p>`).join("")}
        <button class="install-button large" data-modal-install>${this.registry.isInstalled(app.id) ? "Installed" : "Install"}</button>
      </section></div>`;

    dialog.querySelector("[data-close]")?.addEventListener("click", () => dialog.innerHTML = "");
    dialog.querySelector("[data-modal-install]")?.addEventListener("click", () => void this.install(app));
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

  private showInstalled(): void {
    const installed = this.registry.list();
    const dialog = this.root.querySelector<HTMLDivElement>("#dialog");
    if (!dialog) return;
    if (!installed.length) {
      this.notice("No applications are registered as installed on this standalone Store yet. Native installation will be managed by Oqerun OS.");
      return;
    }
    dialog.innerHTML = `<div class="modal-backdrop"><section class="modal"><button class="modal-close" data-close>×</button><p class="eyebrow">INSTALLED</p><h2>Installed applications</h2>${installed.map((app) => `<p class="installed-row"><strong>${app.name}</strong><span>v${app.version}</span></p>`).join("")}</section></div>`;
    dialog.querySelector("[data-close]")?.addEventListener("click", () => dialog.innerHTML = "");
  }

  private showUpdates(): void {
    const updates = this.updates.findUpdates(this.registry.list(), this.catalog.all());
    this.notice(updates.length ? `${updates.length} update(s) are available.` : "No updates are available.");
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
