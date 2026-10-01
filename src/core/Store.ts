import { Catalog, type CatalogSort } from "../catalog/Catalog";
import { catalogData } from "../data/catalog";
import { remoteCatalog } from "../data/remoteCatalog";
import { InstallManager } from "./InstallManager";
import { AppRegistry } from "./AppRegistry";
import { Compatibility } from "./Compatibility";
import { PermissionManager } from "./PermissionManager";
import { Verification } from "./Verification";
import { UpdateManager } from "./UpdateManager";
import { UpdateSettingsManager, type StoreSettings } from "./UpdateSettings";
import { UninstallManager } from "./UninstallManager";
import { OqpkgProvider } from "../providers/OqpkgProvider";
import { PwaProvider } from "../providers/PwaProvider";
import { WebAppProvider } from "../providers/WebAppProvider";
import { WasmProvider } from "../providers/WasmProvider";
import { ExternalProvider } from "../providers/ExternalProvider";
import type { Application } from "../models/App";
import { catalogAssets } from "../data/catalogAssets";
import { InstallationBridge } from "./InstallationBridge";
import { DownloadManager } from "./DownloadManager";

const STORE_VERSION = "0.2.0";
const OQERUN_VERSION = "0.1.0";

function esc(value: unknown): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export class Store {
  private readonly catalog = new Catalog([...catalogData, ...remoteCatalog].map(app => {
    const assets = (catalogAssets as unknown as Record<string, { iconUrl?: string; screenshots?: readonly string[] }>)[app.id];
    return {
      ...app,
      metadata: {
        ...app.metadata,
        iconUrl: app.metadata?.iconUrl ?? assets?.iconUrl,
        screenshots: app.metadata?.screenshots ?? (assets?.screenshots ? [...assets.screenshots] : undefined)
      }
    };
  }));
  private readonly registry = new AppRegistry();
  private readonly verifier = new Verification();
  private readonly permissions = new PermissionManager();
  private readonly updates = new UpdateManager();
  private readonly settings = new UpdateSettingsManager();
  private readonly uninstaller = new UninstallManager();
  private readonly feedbackEndpoint = "";
  private readonly installationBridge = new InstallationBridge();
  private readonly downloads = new DownloadManager();
  private readonly wishlistKey = "oqerun-store-wishlist-v1";
  private readonly wishlist = new Set<string>();
  private readonly installer = new InstallManager([
    new OqpkgProvider(), new PwaProvider(), new WebAppProvider(), new WasmProvider(), new ExternalProvider()
  ]);

  private category = "All";
  private query = "";
  private sort: CatalogSort = "featured";
  private typeFilter = "all";
  private listingFilter = "all";
  private trustFilter = "all";
  private offlineOnly = false;

  constructor(private readonly root: HTMLElement) {
    try {
      const saved = JSON.parse(localStorage.getItem(this.wishlistKey) ?? "[]");
      if (Array.isArray(saved)) {
        saved.filter((id): id is string => typeof id === "string").forEach(id => this.wishlist.add(id));
      }
    } catch {
      // Ignore malformed local wishlist data and start clean.
    }
  }

  render(): void {
    this.root.innerHTML =
      '<div class="store-shell">' +
      '<header class="topbar">' +
      '<button class="brand-button" data-home><div class="brand-mark">O</div><div class="brand-copy"><strong>Oqerun Store</strong><span>Discover. Install. Create.</span></div></button>' +
      '<label class="search"><span>⌕</span><input id="search" type="search" placeholder="Search apps, games, tools..." /><kbd>Ctrl + K</kbd></label>' +
      '<div class="top-actions"><button class="top-icon" data-notifications aria-label="Notifications">♧</button><button class="top-avatar" data-account aria-label="Account">●</button></div>' +
      '</header>' +
      '<div class="store-layout">' +
      '<aside class="store-sidebar">' +
      '<div class="sidebar-group">' +
      '<button class="side-item active" data-home><span>⌂</span>Home</button>' +
      '<button class="side-item" data-category-view><span>◫</span>Apps</button>' +
      '<button class="side-item" data-games><span>♟</span>Games</button>' +
      '<button class="side-item" data-category="Productivity"><span>▣</span>Productivity</button>' +
      '<button class="side-item" data-category="Development"><span>⌘</span>Development</button>' +
      '<button class="side-item" data-category="Media"><span>▶</span>Media</button>' +
      '<button class="side-item" data-category="Education"><span>◇</span>Education</button>' +
      '<button class="side-item" data-category-view><span>✣</span>Tools</button>' +
      '</div>' +
      '<div class="sidebar-divider"></div>' +
      '<div class="sidebar-label">MY LIBRARY</div>' +
      '<button class="side-item" data-installed><span>⇩</span>Installed <b id="installed-count"></b></button>' +
      '<button class="side-item" data-updates><span>↻</span>Updates <b id="update-count"></b></button>' +
      '<button class="side-item" data-wishlist><span>♡</span>Wishlist <b id="wishlist-count"></b></button>' +
      '<div class="sidebar-spacer"></div>' +
      '<button class="os-promo" data-os><div class="promo-mark">O</div><div><strong>Oqerun OS</strong><span>The Web, Reimagined as an Operating System.</span></div><b>›</b></button>' +
      '</aside>' +
      '<section class="store-main">' +
      '<section class="hero hero-modern"><div class="hero-content" id="hero-content"></div><div class="hero-art"><div class="hero-art-glow"></div><div class="hero-app-stack"><span>W</span><span>×</span><span>P</span></div></div></section>' +
      '<div class="store-mode-note"><strong>Browser mode</strong><span>Web and PWA apps can open here. Native Oqerun packages install through Oqerun OS when its installation bridge is available.</span><button class="store-mode-link" data-os>Open Oqerun OS ↗</button></div>' +
      '<section class="content modern-content">' +
      '<div class="section-heading"><div><p class="eyebrow">DISCOVER</p><h2 id="title">All applications</h2></div><div id="stats" class="catalog-stats"></div></div>' +
      '<div id="featured-grid" class="featured-grid"></div>' +
      '<div class="discover-toolbar modern-toolbar"><div id="cats" class="category-list"></div><div class="filter-row">' +
      '<select id="type-filter"><option value="all">All types</option><option value="pwa">PWA</option><option value="web">Web</option><option value="wasm">WASM</option><option value="oqpkg">OQPKG</option><option value="external">External</option></select>' +
      '<select id="listing-filter"><option value="all">All publishers</option><option value="official">Official</option><option value="community">Community</option></select>' +
      '<select id="trust-filter"><option value="all">All trust states</option><option value="official">Official</option><option value="verified">Verified</option><option value="unverified">Unverified</option><option value="blocked">Blocked</option></select>' +
      '<select id="sort-filter"><option value="featured">Featured</option><option value="updated">Recently updated</option><option value="newest">Version</option><option value="name">Name</option></select>' +
      '<label class="toggle-filter"><input id="offline-filter" type="checkbox"> Offline</label></div></div>' +
      '<div class="all-apps-heading"><h2>All Apps</h2><span>Browse the complete catalog</span></div>' +
      '<div id="grid" class="app-grid modern-grid"></div>' +
      '</section>' +
      '</section>' +
      '<aside class="store-rail">' +
      '<section class="rail-panel"><div class="rail-heading"><div><span class="rail-kicker hot">HOT TODAY</span><h2>Popular This Week</h2><p>Apps the Oqerun community is discovering.</p></div><button class="rail-link" data-category-view>View all →</button></div><div id="popular-list" class="popular-list"></div></section>' +
      '<section class="rail-panel"><div class="rail-heading"><div><span class="rail-kicker new">NEW</span><h2>New &amp; Updated</h2><p>Fresh additions and recent releases.</p></div><button class="rail-link" data-category-view>View all →</button></div><div id="updated-list" class="updated-list"></div></section>' +
      '<section class="rail-publish"><div class="publish-art">✦</div><div><h2>Publish Your App</h2><p>Be part of the Oqerun ecosystem. Share your creation with the world.</p><button class="install-button large" data-feedback>Learn More</button></div></section>' +
      '</aside></div>' +
      '<footer class="store-footer">Oqerun Store ' + STORE_VERSION + ' · MIT · VRuntime Labs · Community software remains under its original licenses.</footer>' +
      '<div id="dialog"></div></div>';

    this.applyTheme();
    this.bind();
    this.root.querySelectorAll<HTMLButtonElement>("[data-category]").forEach(b => b.addEventListener("click", () => {
      this.category = b.dataset.category ?? "All";
      this.query = "";
      const search = this.root.querySelector<HTMLInputElement>("#search");
      if (search) search.value = "";
      this.renderCategories();
      this.renderApps();
    }));
    this.root.querySelector("[data-games]")?.addEventListener("click", () => {
      this.category = "Games";
      this.query = "";
      this.renderCategories();
      this.renderApps();
    });
    this.root.querySelector("[data-wishlist]")?.addEventListener("click", () => this.showWishlist());
    this.root.querySelector("[data-notifications]")?.addEventListener("click", () => this.notice("Notifications will appear here when Store updates or security events need your attention."));
    this.root.querySelector("[data-account]")?.addEventListener("click", () => this.notice("Accounts are not connected yet. Oqerun Store can be used without an account."));
    this.root.querySelectorAll("[data-os]").forEach(e => e.addEventListener("click", () => {
      window.open("https://vruntime-labs.github.io/oqerun-os/", "_blank", "noopener,noreferrer");
    }));
    this.renderCategories();
    this.renderApps();
    this.updateBadges();
    if (this.settings.isAuto()) void this.applyAutomaticWebUpdates();
  }

  private bind(): void {
    const searchInput = this.root.querySelector<HTMLInputElement>("#search");
    searchInput?.addEventListener("input", e => {
      this.query = (e.target as HTMLInputElement).value;
      this.renderApps();
    });
    window.addEventListener("keydown", e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInput?.focus();
        searchInput?.select();
      }
      if (e.key === "Escape" && document.activeElement === searchInput) {
        searchInput?.blur();
      }
    });
    this.root.querySelectorAll("[data-home]").forEach(b => b.addEventListener("click", () => this.showCatalog("All")));
    this.root.querySelector("[data-category-view]")?.addEventListener("click", () => this.showCatalog("All"));
    this.root.querySelector("[data-installed]")?.addEventListener("click", () => this.showInstalled());
    this.root.querySelector("[data-updates]")?.addEventListener("click", () => this.showUpdates());
    this.root.querySelector("[data-settings]")?.addEventListener("click", () => this.showSettings());
    this.root.querySelector("[data-notices]")?.addEventListener("click", () => this.showThirdPartyNotices());
    this.root.querySelectorAll("[data-feedback]").forEach(b => b.addEventListener("click", () => this.showFeedback()));

    const change = (id: string, fn: (value: string) => void) => {
      this.root.querySelector<HTMLSelectElement>(id)?.addEventListener("change", e => {
        fn((e.target as HTMLSelectElement).value);
        this.renderApps();
      });
    };
    change("#type-filter", v => { this.typeFilter = v; });
    change("#listing-filter", v => { this.listingFilter = v; });
    change("#trust-filter", v => { this.trustFilter = v; });
    change("#sort-filter", v => { this.sort = v as CatalogSort; });
    this.root.querySelector("#offline-filter")?.addEventListener("change", e => {
      this.offlineOnly = (e.target as HTMLInputElement).checked;
      this.renderApps();
    });
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
    const el = this.root.querySelector<HTMLDivElement>("#cats");
    if (!el) return;
    const categories = ["All", ...new Set(this.catalog.all().map(a => a.category))];
    el.innerHTML = categories.map(c =>
      '<button class="category-chip ' + (c === this.category ? "selected" : "") + '" data-category="' + esc(c) + '">' + esc(c) + "</button>"
    ).join("");
    el.querySelectorAll<HTMLButtonElement>("[data-category]").forEach(b => b.addEventListener("click", () => {
      this.category = b.dataset.category ?? "All";
      this.query = "";
      const search = this.root.querySelector<HTMLInputElement>("#search");
      if (search) search.value = "";
      this.renderCategories();
      this.renderApps();
    }));
  }

  private filteredApps(): Application[] {
    const base = this.query ? this.catalog.search(this.query) : this.catalog.all();
    return this.catalog.sort(base.filter(app => {
      const trust = app.metadata?.reviewStatus ?? (app.listing === "official" ? "official" : "unverified");
      if (this.category !== "All" && app.category !== this.category) return false;
      if (this.typeFilter !== "all" && app.type !== this.typeFilter) return false;
      if (this.listingFilter !== "all" && app.listing !== this.listingFilter) return false;
      if (this.trustFilter !== "all" && trust !== this.trustFilter) return false;
      if (this.offlineOnly && app.metadata?.offline !== true) return false;
      return true;
    }), this.sort);
  }

  private renderApps(): void {
    const grid = this.root.querySelector<HTMLDivElement>("#grid");
    const title = this.root.querySelector<HTMLHeadingElement>("#title");
    const stats = this.root.querySelector<HTMLDivElement>("#stats");
    const featuredGrid = this.root.querySelector<HTMLDivElement>("#featured-grid");
    const popularList = this.root.querySelector<HTMLDivElement>("#popular-list");
    const updatedList = this.root.querySelector<HTMLDivElement>("#updated-list");
    const heroContent = this.root.querySelector<HTMLDivElement>("#hero-content");
    if (!grid || !title || !stats || !featuredGrid || !popularList || !updatedList || !heroContent) return;

    const apps = this.filteredApps();
    const all = this.catalog.all();
    const defaultView = !this.query && this.category === "All" && this.typeFilter === "all" && this.listingFilter === "all" && this.trustFilter === "all" && !this.offlineOnly && this.sort === "featured";
    title.textContent = this.query ? "Search results" : defaultView ? "All applications" : this.category === "All" ? "All applications" : this.category;
    stats.textContent = apps.length + " application" + (apps.length === 1 ? "" : "s") + " · " + all.length + " in catalog";

    const featured = all.filter(a => a.featured).slice(0, 5);
    const hero = featured[0] ?? all[0];
    if (hero) {
      const heroIcon = hero.metadata?.iconUrl
        ? '<img src="' + esc(hero.metadata.iconUrl) + '" alt="" loading="eager">'
        : '<span>' + esc(hero.icon) + '</span>';
      heroContent.innerHTML =
        '<span class="hero-pill">Featured</span><h1>' + esc(hero.name) + '</h1><h3>Create. Edit. Collaborate.</h3>' +
        '<p>' + esc(hero.description) + '</p><div class="hero-tags"><span>' + esc(hero.category) + '</span><span>' + (hero.listing === "official" ? "Official" : "Community") + '</span><span>Free</span></div>' +
        '<div class="hero-actions">' + this.actionMarkup(hero, "hero") + '<button class="install-button secondary hero-button" data-details="' + esc(hero.id) + '">View details</button>' + this.wishlistMarkup(hero, "hero") + '</div>';
      const art = this.root.querySelector<HTMLDivElement>(".hero-app-stack");
      if (art) art.innerHTML = heroIcon;
      this.bindAppButtons(heroContent);
    } else {
      heroContent.innerHTML = '<span class="hero-pill">Oqerun Store</span><h1>Discover software.</h1><p>Open-source applications for Oqerun OS.</p>';
    }

    const showDiscovery = defaultView && !this.query && this.category === "All";
    featuredGrid.innerHTML = showDiscovery && featured.length
      ? '<div class="subsection-heading"><h2>Featured Apps</h2><button class="rail-link" data-category-view>View all →</button></div><div class="featured-cards">' + featured.map(a => this.card(a, true)).join("") + '</div>'
      : "";
    this.bindAppButtons(featuredGrid);

    const popular = all.filter(a => a.metadata?.reviewStatus !== "blocked").slice().sort((a,b) => {
      const af = a.featured ? 1 : 0, bf = b.featured ? 1 : 0;
      return bf - af || a.name.localeCompare(b.name);
    }).slice(0, 5);
    popularList.innerHTML = popular.map((a, i) => this.railApp(a, i + 1)).join("");
    this.bindAppButtons(popularList);

    const updated = all.filter(a => a.metadata?.reviewStatus !== "blocked").slice().sort((a,b) => String(b.metadata?.lastUpdated ?? "").localeCompare(String(a.metadata?.lastUpdated ?? ""))).slice(0, 6);
    updatedList.innerHTML = updated.map(a => this.railUpdated(a)).join("");
    this.bindAppButtons(updatedList);

    if (!apps.length) {
      grid.innerHTML = '<div class="empty-state"><strong>No applications found.</strong><span>Try another search or adjust the filters.</span></div>';
      return;
    }
    grid.innerHTML = apps.map(a => this.card(a)).join("");
    this.bindAppButtons(grid);
  }

  private bindAppButtons(container: HTMLElement): void {
    container.querySelectorAll<HTMLButtonElement>("[data-install]").forEach(b => b.addEventListener("click", () => {
      const a = this.catalog.find(b.dataset.install ?? ""); if (a) void this.install(a);
    }));
    container.querySelectorAll<HTMLButtonElement>("[data-update]").forEach(b => b.addEventListener("click", () => {
      const a = this.catalog.find(b.dataset.update ?? ""); if (a) void this.update(a);
    }));
    container.querySelectorAll<HTMLButtonElement>("[data-open]").forEach(b => b.addEventListener("click", () => {
      const a = this.catalog.find(b.dataset.open ?? ""); if (a) this.openApp(a);
    }));
    container.querySelectorAll<HTMLButtonElement>("[data-details]").forEach(b => b.addEventListener("click", () => {
      const a = this.catalog.find(b.dataset.details ?? ""); if (a) this.details(a);
    }));
    container.querySelectorAll<HTMLButtonElement>("[data-download]").forEach(b => b.addEventListener("click", () => {
      const a = this.catalog.find(b.dataset.download ?? ""); if (a) void this.download(a);
    }));
    container.querySelectorAll<HTMLButtonElement>("[data-wishlist-toggle]").forEach(b => b.addEventListener("click", () => {
      const a = this.catalog.find(b.dataset.wishlistToggle ?? ""); if (a) this.toggleWishlist(a);
    }));
  }

  private card(app: Application, compact = false): string {
    const installed = this.registry.get(app.id);
    const update = installed ? this.updates.findUpdates([installed], [app])[0] : undefined;
    const trust = app.metadata?.reviewStatus ?? (app.listing === "official" ? "official" : "unverified");
    const listing = '<span class="listing-badge ' + app.listing + '">' + (app.listing === "official" ? "Official" : "Community") + "</span>";
    const browserLaunch = app.type === "web" || app.type === "pwa" || app.type === "external";
    let action = this.actionMarkup(app, "card");
    if (update) action = '<button class="install-button update-button" data-update="' + esc(app.id) + '">Update</button>';
    else if (installed && app.installation.url) action = '<div class="card-actions"><button class="install-button" data-open="' + esc(app.id) + '">Open</button><button class="icon-button" data-details="' + esc(app.id) + '">•••</button></div>';
    else if (installed) action = '<button class="install-button" data-details="' + esc(app.id) + '">Installed</button>';

    if (compact) {
      return '<article class="featured-card"><button class="app-icon" data-details="' + esc(app.id) + '">' + (app.metadata?.iconUrl ? '<img src="' + esc(app.metadata.iconUrl) + '" alt="" loading="lazy">' : '') + '<span>' + esc(app.icon) + '</span></button>' +
        '<div class="featured-card-title"><h3>' + esc(app.name) + '</h3>' + listing + '</div><p class="publisher">v' + esc(app.version) + ' · ' + esc(app.publisher.name) + '</p><p class="description">' + esc(app.description) + '</p>' +
        '<div class="app-meta"><span>' + esc(app.category) + '</span><span>' + esc(app.type) + '</span></div><div class="app-card-action-row">' + action + this.wishlistMarkup(app) + '</div></article>';
    }

    return '<article class="app-card modern-card"><button class="app-icon" data-details="' + esc(app.id) + '">' + (app.metadata?.iconUrl ? '<img src="' + esc(app.metadata.iconUrl) + '" alt="" loading="lazy">' : '') + '<span>' + esc(app.icon) + '</span></button>' +
      '<div class="app-card-body"><div class="app-card-title"><h3>' + esc(app.name) + "</h3>" + listing + '</div>' +
      '<p class="publisher">v' + esc(app.version) + ' · ' + esc(app.publisher.name) + '</p><p class="description">' + esc(app.description) + "</p>" +
      '<div class="app-meta"><span>' + esc(app.category) + "</span><span>" + esc(app.type) + "</span>" + (app.metadata?.offline ? "<span>Offline</span>" : "") + '</div><div class="app-card-action-row">' + action + this.wishlistMarkup(app) + "</div></div></article>";
  }

  private railApp(app: Application, rank: number): string {
    return '<article class="popular-row"><span class="rank">' + rank + '</span><button class="rail-icon" data-details="' + esc(app.id) + '">' + (app.metadata?.iconUrl ? '<img src="' + esc(app.metadata.iconUrl) + '" alt="" loading="lazy">' : esc(app.icon)) + '</button><div class="rail-app-copy"><strong>' + esc(app.name) + '</strong><span>' + esc(app.category) + ' · ' + (app.listing === "official" ? "Official" : "Community") + '</span></div><div class="rail-actions">' + this.actionMarkup(app, "rail") + this.wishlistMarkup(app, "rail") + '</div></article>';
  }

  private railUpdated(app: Application): string {
    return '<article class="updated-row"><button class="rail-icon" data-details="' + esc(app.id) + '">' + (app.metadata?.iconUrl ? '<img src="' + esc(app.metadata.iconUrl) + '" alt="" loading="lazy">' : esc(app.icon)) + '</button><div class="rail-app-copy"><strong>' + esc(app.name) + '</strong><span>v' + esc(app.version) + ' · ' + esc(app.publisher.name) + '</span></div><div class="rail-actions">' + this.actionMarkup(app, "rail") + this.wishlistMarkup(app, "rail") + '</div></article>';
  }

  private isWishlisted(app: Application): boolean {
    return this.wishlist.has(app.id);
  }

  private wishlistMarkup(app: Application, context: "hero" | "card" | "rail" | "detail" = "card"): string {
    const active = this.isWishlisted(app);
    const label = active ? "Remove from wishlist" : "Add to wishlist";
    const icon = active ? "♥" : "♡";
    const cls = context === "hero" ? "wishlist-button hero-wishlist" : context === "rail" ? "wishlist-button rail-wishlist" : context === "detail" ? "wishlist-button detail-wishlist" : "wishlist-button";
    return '<button type="button" class="' + cls + (active ? " active" : "") + '" data-wishlist-toggle="' + esc(app.id) + '" aria-label="' + esc(label) + '" title="' + esc(label) + '">' + icon + '</button>';
  }

  private persistWishlist(): void {
    try {
      localStorage.setItem(this.wishlistKey, JSON.stringify([...this.wishlist]));
    } catch {
      this.notice("Wishlist could not be saved in this browser.");
    }
  }

  private toggleWishlist(app: Application): void {
    const removing = this.wishlist.has(app.id);
    if (removing) this.wishlist.delete(app.id);
    else this.wishlist.add(app.id);

    this.persistWishlist();
    this.renderApps();
    this.updateBadges();

    const dialog = this.root.querySelector<HTMLDivElement>("#dialog");
    if (dialog?.querySelector(".wishlist-modal")) this.showWishlist();
    else if (dialog?.querySelector(".app-details-modal")) this.details(app);
    else this.notice(app.name + (removing ? " removed from Wishlist." : " added to Wishlist."));
  }

  private showWishlist(): void {
    const dialog = this.root.querySelector<HTMLDivElement>("#dialog");
    if (!dialog) return;

    const apps = [...this.wishlist]
      .map(id => this.catalog.find(id))
      .filter((app): app is Application => Boolean(app));

    const rows = apps.map(app =>
      '<article class="wishlist-row">' +
      '<button class="wishlist-app-icon" data-details="' + esc(app.id) + '">' +
      (app.metadata?.iconUrl ? '<img src="' + esc(app.metadata.iconUrl) + '" alt="" loading="lazy">' : esc(app.icon)) +
      '</button>' +
      '<div class="wishlist-app-copy"><strong>' + esc(app.name) + '</strong><span>' + esc(app.publisher.name) + ' · ' + esc(app.category) + ' · v' + esc(app.version) + '</span></div>' +
      '<div class="row-actions">' + this.actionMarkup(app, "card") + '<button class="icon-button" data-wishlist-toggle="' + esc(app.id) + '" title="Remove from wishlist" aria-label="Remove from wishlist">♥</button></div>' +
      '</article>'
    ).join("");

    dialog.innerHTML = '<div class="modal-backdrop"><section class="modal wide-modal wishlist-modal"><button class="modal-close" data-close>×</button>' +
      '<p class="eyebrow">MY LIBRARY</p><h2>Wishlist</h2><p>Save apps you want to revisit. Your wishlist is stored locally in this browser.</p>' +
      '<div class="wishlist-list">' + (rows || '<div class="empty-state"><strong>Your wishlist is empty.</strong><span>Use the ♡ button on any app to save it here.</span></div>') + '</div></section></div>';

    dialog.querySelector("[data-close]")?.addEventListener("click", () => dialog.innerHTML = "");
    this.bindAppButtons(dialog);
  }

  private actionMarkup(app: Application, context: "hero" | "card" | "rail"): string {
    const cls = context === "hero" ? "install-button hero-button" : context === "rail" ? "rail-install" : "install-button";
    const browserLaunch = (app.type === "web" || app.type === "pwa") && Boolean(app.installation.url);
    const downloadable = Boolean(app.installation.downloadUrl) || (app.source.type === "github" && Boolean(app.source.repository));

    if (browserLaunch) return '<button class="' + cls + '" data-open="' + esc(app.id) + '">Open ↗</button>';
    if (app.type === "oqpkg") {
      if (this.installationBridge.isAvailable()) return '<button class="' + cls + '" data-install="' + esc(app.id) + '">Install</button>';
      if (downloadable) return '<button class="' + cls + '" data-download="' + esc(app.id) + '">Download</button>';
      return '<a class="' + cls + ' action-disabled-link" href="https://vruntime-labs.github.io/oqerun-os/" target="_blank" rel="noopener noreferrer">Open Oqerun OS ↗</a>';
    }
    if (app.type === "wasm" && app.installation.url) {
      return '<div class="card-actions"><button class="' + cls + '" data-open="' + esc(app.id) + '">Open ↗</button>' +
        (downloadable ? '<button class="icon-button" data-download="' + esc(app.id) + '" title="Download">⇩</button>' : '') + '</div>';
    }
    if (downloadable) return '<button class="' + cls + '" data-download="' + esc(app.id) + '">Download</button>';
    if (app.installation.url) return '<button class="' + cls + '" data-open="' + esc(app.id) + '">Open ↗</button>';
    return '<button class="' + cls + ' action-disabled" disabled>Not downloadable</button>';
  }

  private details(app: Application): void {
    const dialog = this.root.querySelector<HTMLDivElement>("#dialog");
    if (!dialog) return;
    const verification = this.verifier.verify(app);
    const known = this.permissions.validate(app.permissions);
    const unknown = this.permissions.unknown(app.permissions);
    const installed = this.registry.get(app.id);
    const update = installed ? this.updates.findUpdates([installed], [app])[0] : undefined;
    const trust = app.metadata?.reviewStatus ?? (app.listing === "official" ? "official" : "unverified");
    const source = this.sourceUrl(app);
    const homepage = app.metadata?.homepage;
    const iconUrl = app.metadata?.iconUrl;
    const screenshots = app.metadata?.screenshots ?? [];

    const browserLaunch = app.type === "web" || app.type === "pwa";
    const downloadable = Boolean(app.installation.downloadUrl) || (app.source.type === "github" && Boolean(app.source.repository));
    let action = update
      ? '<button class="install-button large" data-modal-update>Update to ' + esc(app.version) + "</button>"
      : installed
        ? '<div class="detail-actions"><button class="install-button large" data-modal-open>Open</button><button class="install-button secondary large" data-modal-uninstall>Uninstall</button></div>'
        : app.type === "oqpkg" && this.installationBridge.isAvailable()
          ? '<button class="install-button large" data-modal-install>Install in Oqerun OS</button>'
          : browserLaunch && app.installation.url
            ? '<button class="install-button large" data-modal-open>Open app ↗</button>'
            : downloadable
              ? '<button class="install-button large" data-modal-download>Download release</button>'
              : app.installation.url
                ? '<button class="install-button large" data-modal-open>Open source ↗</button>'
                : '<button class="install-button large action-disabled" disabled>Download unavailable</button>';

    let details = '<span>Publisher<strong>' + esc(app.publisher.name) + "</strong></span>" +
      '<span>License<strong>' + esc(app.license) + "</strong></span>" +
      '<span>Trust<strong>' + esc(trust) + "</strong></span>" +
      '<span>Oqerun<strong>' + esc(app.compatibility.minimumOqerunVersion) + "+</strong></span>" +
      '<span>Type<strong>' + esc(app.type) + "</strong></span>" +
      '<span>Version source<strong>' + esc(app.metadata?.versionStrategy ?? "catalog") + "</strong></span>" +
      '<span>Last updated<strong>' + esc(app.metadata?.lastUpdated ?? "Not published") + "</strong></span>" +
      '<span>Offline<strong>' + (app.metadata?.offline ? "Yes" : "Not declared") + "</strong></span>" +
      '<span>Permissions<strong>' + (known.length ? esc(known.join(", ")) : "None listed") + (unknown.length ? " (unknown: " + esc(unknown.join(", ")) + ")" : "") + "</strong></span>" +
      '<span>File types<strong>' + esc((app.fileAssociations ?? []).join(", ") || "None declared") + "</strong></span>" +
      (app.installation.sha256 ? '<span>SHA-256<strong class="hash">' + esc(app.installation.sha256) + "</strong></span>" : "");

      const screenshotMarkup = screenshots.length
      ? '<section class="screenshot-section"><div class="screenshot-heading"><div><p class="eyebrow">PREVIEW</p><h3>Screenshots</h3></div><span>' + screenshots.length + ' image' + (screenshots.length === 1 ? '' : 's') + '</span></div><div class="screenshots">' +
        screenshots.map((url, index) => '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer"><img src="' + esc(url) + '" alt="' + esc(app.name) + ' screenshot ' + (index + 1) + '" loading="lazy" onerror="this.closest(\'a\')?.remove()"></a>').join("") +
        '</div></section>'
      : '<div class="screenshot-empty">No screenshots have been published by this app yet.</div>';

    dialog.innerHTML = '<div class="modal-backdrop"><section class="modal app-details-modal"><button class="modal-close" data-close>×</button>' +
      '<div class="modal-icon">' + (iconUrl ? '<img src="' + esc(iconUrl) + '" alt="" loading="lazy">' : '') + '<span>' + esc(app.icon) + '</span></div><div class="badge-row"><span class="listing-badge ' + app.listing + '">' + (app.listing === "official" ? "Official" : "Community") + '</span><span class="trust-badge ' + trust + '">' + esc(trust) + "</span></div>" +
      '<p class="eyebrow">' + esc(app.category) + " · " + esc(app.type) + '</p><h2>' + esc(app.name) + "</h2><p class=\"modal-publisher\">" + esc(app.publisher.name) + " · v" + esc(app.version) + "</p><p>" + esc(app.description) + "</p>" +
      '<div class="listing-notice ' + app.listing + '"><strong>' + (app.listing === "community" ? "Independent community project" : "Official Oqerun application") + "</strong><span>" +
      (app.listing === "community" ? "The original project, publisher, branding and license remain separate from VRuntime Labs." : "Published by VRuntime Labs for the Oqerun ecosystem.") + "</span></div>" +
      screenshotMarkup + '<div class="details-grid">' + details + "</div>" +
      '<div class="source-links">' + (source ? '<a href="' + esc(source) + '" target="_blank" rel="noopener noreferrer">Original source ↗</a>' : "") +
      (homepage ? '<a href="' + esc(homepage) + '" target="_blank" rel="noopener noreferrer">Website ↗</a>' : "") +
      (source ? '<a href="' + esc(source + "/blob/HEAD/LICENSE") + '" target="_blank" rel="noopener noreferrer">License ↗</a>' : "") + "</div>" +
      verification.warnings.map(w => '<p class="store-warning">⚠ ' + esc(w) + "</p>").join("") +
      verification.errors.map(e => '<p class="store-error">✕ ' + esc(e) + "</p>").join("") +
      (update ? '<p class="store-update">Update available: v' + esc(update.currentVersion) + " → v" + esc(update.availableVersion) + "</p>" : "") +
      action + "</section></div>";

    dialog.querySelectorAll("[data-close]").forEach(e => e.addEventListener("click", () => dialog.innerHTML = ""));
    dialog.querySelector("[data-modal-install]")?.addEventListener("click", () => void this.install(app));
    dialog.querySelector("[data-modal-download]")?.addEventListener("click", () => void this.download(app));
    dialog.querySelector("[data-modal-update]")?.addEventListener("click", () => void this.update(app));
    dialog.querySelector("[data-modal-open]")?.addEventListener("click", () => this.openApp(app));
    dialog.querySelector("[data-modal-uninstall]")?.addEventListener("click", () => void this.uninstall(app));
    dialog.querySelector("[data-wishlist-toggle]")?.addEventListener("click", () => this.toggleWishlist(app));
  }

  private sourceUrl(app: Application): string | undefined {
    return app.source.type === "github" && app.source.repository ? "https://github.com/" + app.source.repository : app.source.url;
  }

  private async install(app: Application): Promise<void> {
    const verification = this.verifier.verify(app);
    if (!verification.valid) return this.notice(verification.errors.join(" "));
    if (app.metadata?.reviewStatus === "blocked") return this.notice("This application is blocked from installation by the Store.");
    if (!Compatibility.meetsMinimum(OQERUN_VERSION, app.compatibility.minimumOqerunVersion)) return this.notice("This application requires Oqerun " + app.compatibility.minimumOqerunVersion + " or newer.");

    if (this.settings.get().confirmInstall) {
      const warning = app.listing === "community"
        ? "Install " + app.name + "? This is a community application from " + app.publisher.name + ". Review its source, license and permissions before installing."
        : "Install " + app.name + "?";
      if (!window.confirm(warning)) return;
    }

    try {
      await this.installer.install(app);
      this.registry.register(app);
      this.updateBadges();
      this.renderApps();
      this.notice(app.name + " is now registered as installed.");
    } catch (error) {
      this.notice(error instanceof Error ? error.message : "Installation could not be started.");
    }
  }

  private async download(app: Application): Promise<void> {
    const verification = this.verifier.verify(app);
    if (!verification.valid) return this.notice(verification.errors.join(" "));
    if (app.metadata?.reviewStatus === "blocked") return this.notice("This application is blocked from downloads by the Store.");

    try {
      const target = await this.downloads.download(app);
      const sourceLabel = target.source === "github-release" ? "GitHub release" : target.source === "github-source" ? "GitHub source archive" : "publisher-provided download";
      this.notice("Download started: " + target.fileName + " (" + sourceLabel + "). Source and license remain with the original open-source project.");
    } catch (error) {
      this.notice(error instanceof Error ? error.message : "The application could not be downloaded.");
    }
  }

  private openApp(app: Application): void {
    if (!app.installation.url) return this.notice("This application does not publish a launch URL in the standalone Store.");
    window.open(app.installation.url, "_blank", "noopener,noreferrer");
  }

  private async update(app: Application): Promise<void> {
    const installed = this.registry.get(app.id);
    if (!installed) return this.install(app);
    if ((app.type === "web" || app.type === "pwa") && app.installation.url) {
      const url = new URL(app.installation.url, window.location.href);
      url.searchParams.set("oqerun-update", Date.now().toString());
      window.open(url.toString(), "_blank", "noopener,noreferrer");
      this.registry.register(app);
      this.updateBadges();
      this.renderApps();
      return this.notice(app.name + " is available at the latest deployed version.");
    }
    try {
      await this.installer.install(app);
      this.registry.register(app);
      this.updateBadges();
      this.renderApps();
      this.notice(app.name + " was updated to v" + app.version + ".");
    } catch (error) {
      this.notice(error instanceof Error ? error.message : "This application cannot be updated from the standalone Store yet.");
    }
  }

  private async uninstall(app: Application): Promise<void> {
    if (!window.confirm("Uninstall " + app.name + "?")) return;
    try {
      await this.uninstaller.uninstall(app);
      this.registry.unregister(app.id);
      this.updateBadges();
      this.renderApps();
      this.notice(app.name + " was removed from Installed.");
    } catch (error) {
      this.notice(error instanceof Error ? error.message : "Uninstall could not be completed.");
    }
  }

  private showInstalled(): void {
    const dialog = this.root.querySelector<HTMLDivElement>("#dialog");
    if (!dialog) return;
    const installed = this.registry.list();
    const rows = installed.map(item => {
      const app = this.catalog.find(item.id);
      const update = app ? this.updates.findUpdates([item], [app])[0] : undefined;
      return '<article class="installed-row"><div><strong>' + esc(item.name) + '</strong><span>v' + esc(item.version) + " · installed " + esc(new Date(item.installedAt).toLocaleDateString()) +
        '</span></div><div class="row-actions">' + (update ? '<button class="install-button small" data-update="' + item.id + '">Update</button>' : app?.installation.url ? '<button class="install-button small" data-open="' + item.id + '">Open</button>' : "") +
        (app ? '<button class="install-button secondary small" data-uninstall="' + item.id + '">Uninstall</button>' : "") + "</div></article>";
    }).join("");

    dialog.innerHTML = '<div class="modal-backdrop"><section class="modal wide-modal"><button class="modal-close" data-close>×</button><p class="eyebrow">INSTALLED</p><h2>Installed applications</h2>' +
      '<div class="installed-summary"><strong>' + installed.length + '</strong><span>installed · ' + this.formatBytes(this.registry.totalSize()) + " recorded</span></div>" +
      '<div class="installed-list">' + (rows || '<div class="empty-state"><strong>No installed applications.</strong><span>Install an app from the catalog to see it here.</span></div>') + "</div></section></div>";

    dialog.querySelector("[data-close]")?.addEventListener("click", () => dialog.innerHTML = "");
    dialog.querySelectorAll<HTMLButtonElement>("[data-update]").forEach(b => b.addEventListener("click", () => { const a = this.catalog.find(b.dataset.update ?? ""); if (a) void this.update(a); }));
    dialog.querySelectorAll<HTMLButtonElement>("[data-open]").forEach(b => b.addEventListener("click", () => { const a = this.catalog.find(b.dataset.open ?? ""); if (a) this.openApp(a); }));
    dialog.querySelectorAll<HTMLButtonElement>("[data-uninstall]").forEach(b => b.addEventListener("click", () => { const a = this.catalog.find(b.dataset.uninstall ?? ""); if (a) void this.uninstall(a); }));
  }

  private showUpdates(): void {
    const dialog = this.root.querySelector<HTMLDivElement>("#dialog");
    if (!dialog) return;
    const updates = this.updates.findUpdates(this.registry.list(), this.catalog.all());
    if (!updates.length) return this.notice("No updates are available.");
    const rows = updates.map(u => '<article class="update-row"><div><strong>' + esc(u.app.name) + '</strong><span>v' + esc(u.currentVersion) + " → v" + esc(u.availableVersion) + " · " + esc(u.app.metadata?.versionStrategy ?? "catalog") +
      '</span></div><button class="install-button small" data-update="' + u.app.id + '">Update</button></article>').join("");
    dialog.innerHTML = '<div class="modal-backdrop"><section class="modal wide-modal"><button class="modal-close" data-close>×</button><p class="eyebrow">UPDATES</p><h2>' +
      updates.length + " update" + (updates.length === 1 ? "" : "s") + ' available</h2><p>Mode: <strong>' + (this.settings.isAuto() ? "Automatic" : "Manual") +
      '</strong></p><div class="update-list">' + rows + '</div><button class="install-button large" data-update-all>Update all compatible web/PWA apps</button></section></div>';
    dialog.querySelector("[data-close]")?.addEventListener("click", () => dialog.innerHTML = "");
    dialog.querySelectorAll<HTMLButtonElement>("[data-update]").forEach(b => b.addEventListener("click", () => { const a = this.catalog.find(b.dataset.update ?? ""); if (a) void this.update(a); }));
    dialog.querySelector("[data-update-all]")?.addEventListener("click", () => void this.updateAllWeb());
  }

  private async updateAllWeb(): Promise<void> {
    for (const item of this.updates.findUpdates(this.registry.list(), this.catalog.all()).filter(u => u.app.type === "web" || u.app.type === "pwa")) await this.update(item.app);
  }

  private showSettings(): void {
    const dialog = this.root.querySelector<HTMLDivElement>("#dialog");
    if (!dialog) return;
    const s = this.settings.get();
    dialog.innerHTML = '<div class="modal-backdrop"><section class="modal compact"><button class="modal-close" data-close>×</button><p class="eyebrow">STORE SETTINGS</p><h2>Settings</h2>' +
      '<div class="settings-section"><h3>Updates</h3><button class="mode-option ' + (s.updates.mode === "manual" ? "selected" : "") + '" data-mode="manual"><strong>Manual updates</strong><span>Choose when to apply updates.</span></button>' +
      '<button class="mode-option ' + (s.updates.mode === "auto" ? "selected" : "") + '" data-mode="auto"><strong>Automatic updates</strong><span>Synchronize web/PWA catalog entries automatically. Native packages remain OS-controlled.</span></button></div>' +
      '<div class="settings-section"><h3>Appearance</h3><select id="theme-setting"><option value="system">System</option><option value="dark">Dark</option><option value="light">Light</option></select></div>' +
      '<div class="settings-section"><h3>Installation</h3><label class="setting-check"><input id="confirm-install" type="checkbox" ' + (s.confirmInstall ? "checked" : "") + '> Ask before installing apps</label></div>' +
      '<div class="settings-section"><h3>Notifications & privacy</h3><label class="setting-check"><input id="update-notifications" type="checkbox" ' + (s.updateNotifications ? "checked" : "") + '> Notify me about updates</label>' +
      '<label class="setting-check"><input id="usage-stats" type="checkbox" ' + (s.anonymousUsageStats ? "checked" : "") + '> Allow anonymous usage statistics</label><p class="settings-note">Usage statistics are disabled by default.</p></div></section></div>';

    const theme = dialog.querySelector<HTMLSelectElement>("#theme-setting");
    if (theme) theme.value = s.theme;
    dialog.querySelector("[data-close]")?.addEventListener("click", () => dialog.innerHTML = "");
    dialog.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach(b => b.addEventListener("click", () => {
      this.settings.setMode(b.dataset.mode as StoreSettings["updates"]["mode"]);
      this.showSettings();
      if (b.dataset.mode === "auto") void this.applyAutomaticWebUpdates();
    }));
    theme?.addEventListener("change", () => { this.settings.set("theme", theme.value as StoreSettings["theme"]); this.applyTheme(); });
    dialog.querySelector("#confirm-install")?.addEventListener("change", e => this.settings.set("confirmInstall", (e.target as HTMLInputElement).checked));
    dialog.querySelector("#update-notifications")?.addEventListener("change", e => this.settings.set("updateNotifications", (e.target as HTMLInputElement).checked));
    dialog.querySelector("#usage-stats")?.addEventListener("change", e => this.settings.set("anonymousUsageStats", (e.target as HTMLInputElement).checked));
  }

  private applyTheme(): void {
    this.root.dataset.theme = this.settings.get().theme;
  }

  private async applyAutomaticWebUpdates(): Promise<void> {
    for (const item of this.updates.findUpdates(this.registry.list(), this.catalog.all()).filter(u => u.app.type === "web" || u.app.type === "pwa")) this.registry.register(item.app);
    this.updateBadges();
    this.renderApps();
  }

  private showThirdPartyNotices(): void {
    const dialog = this.root.querySelector<HTMLDivElement>("#dialog");
    if (!dialog) return;
    const apps = this.catalog.all().filter(a => a.listing === "community");
    const rows = apps.map(a => '<article class="notice-item"><div><strong>' + esc(a.name) + '</strong><span>' + esc(a.publisher.name) + " · " + esc(a.license) +
      '</span></div>' + (this.sourceUrl(a) ? '<a href="' + esc(this.sourceUrl(a)) + '" target="_blank" rel="noopener noreferrer">Source ↗</a>' : "") + "</article>").join("");
    dialog.innerHTML = '<div class="modal-backdrop"><section class="modal notices-modal"><button class="modal-close" data-close>×</button><p class="eyebrow">THIRD-PARTY NOTICES</p><h2>Community applications</h2>' +
      '<p class="notices-intro">These are independent open-source projects. Oqerun Store preserves their original publisher, source and license identity.</p><div class="notice-list">' + rows +
      '</div><p class="notices-footer">For license questions or listing corrections, contact the original maintainer through the project repository.</p><button class="install-button large" data-close>Close</button></section></div>';
    dialog.querySelectorAll("[data-close]").forEach(e => e.addEventListener("click", () => dialog.innerHTML = ""));
  }

  private showFeedback(): void {
    const dialog = this.root.querySelector<HTMLDivElement>("#dialog");
    if (!dialog) return;
    const options = this.catalog.all().map(a => '<option value="' + esc(a.name) + '">' + esc(a.name) + "</option>").join("");
    dialog.innerHTML = '<div class="modal-backdrop"><section class="modal feedback-modal"><button class="modal-close" data-close>×</button><p class="eyebrow">STORE FEEDBACK</p><h2>Tell us what you think</h2>' +
      '<p class="feedback-intro">Reviews, bug reports, suggestions and custom messages are welcome.</p><form id="feedback-form" class="feedback-form">' +
      '<label>App<select name="app"><option>Oqerun Store</option>' + options + '</select></label><label>Feedback type<select name="type"><option>Review</option><option>Bug report</option><option>Suggestion</option><option>Other</option></select></label>' +
      '<label>Rating <span class="optional">(optional)</span><select name="rating"><option value="">No rating</option><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select></label>' +
      '<label>Custom Message<textarea name="message" maxlength="3000" required placeholder="Write anything you want us to know..."></textarea></label><label>Contact <span class="optional">(optional)</span><input name="contact" maxlength="200" placeholder="Email or other contact method"></label>' +
      '<p class="feedback-auto">Automatically included: timestamp, Store version ' + STORE_VERSION + ', and source page.</p><p class="feedback-privacy">Please do not include passwords, payment details, or sensitive information.</p>' +
      '<div class="feedback-actions"><button type="button" class="install-button secondary" data-close>Cancel</button><button type="submit" class="install-button large">Send feedback</button></div><p id="feedback-status" class="feedback-status" aria-live="polite"></p></form></section></div>';

    dialog.querySelectorAll("[data-close]").forEach(e => e.addEventListener("click", () => dialog.innerHTML = ""));
    const form = dialog.querySelector<HTMLFormElement>("#feedback-form");
    const status = dialog.querySelector<HTMLParagraphElement>("#feedback-status");
    form?.addEventListener("submit", async e => {
      e.preventDefault();
      const data = new FormData(form);
      const message = String(data.get("message") ?? "").trim();
      if (!message) { if (status) status.textContent = "Please enter a custom message."; return; }
      if (!this.feedbackEndpoint) { if (status) status.textContent = "Feedback form is ready, but the secure Sheets endpoint has not been configured yet."; return; }
      const payload = {
        timestamp: new Date().toISOString(), app: String(data.get("app") ?? ""), type: String(data.get("type") ?? ""),
        rating: String(data.get("rating") ?? ""), message, contact: String(data.get("contact") ?? "").trim(),
        storeVersion: STORE_VERSION, source: window.location.href
      };
      try {
        await fetch(this.feedbackEndpoint, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload), mode: "no-cors" });
        if (status) status.textContent = "Thank you! Your feedback was sent.";
        form.reset();
      } catch { if (status) status.textContent = "We couldn't send the feedback. Please try again."; }
    });
  }

  private updateBadges(): void {
    const installed = this.root.querySelector<HTMLElement>("#installed-count");
    const updates = this.root.querySelector<HTMLElement>("#update-count");
    const wishlist = this.root.querySelector<HTMLElement>("#wishlist-count");
    const list = this.registry.list();
    const count = this.updates.findUpdates(list, this.catalog.all()).length;
    if (installed) installed.textContent = list.length ? "· " + list.length : "";
    if (updates) updates.textContent = count ? "· " + count : "";
    if (wishlist) wishlist.textContent = this.wishlist.size ? "· " + this.wishlist.size : "";
  }

  private notice(message: string): void {
    const dialog = this.root.querySelector<HTMLDivElement>("#dialog");
    if (!dialog) return;
    dialog.innerHTML = '<div class="modal-backdrop"><section class="modal compact"><button class="modal-close" data-close>×</button><div class="notice-icon">!</div><h2>Store notice</h2><p>' + esc(message) + '</p><button class="install-button large" data-close>Close</button></section></div>';
    dialog.querySelectorAll("[data-close]").forEach(e => e.addEventListener("click", () => dialog.innerHTML = ""));
  }

  private formatBytes(bytes: number): string {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return (bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0) + " " + units[i];
  }
}
