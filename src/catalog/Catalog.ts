import type { Application } from "../models/App";

export type CatalogSort = "featured" | "newest" | "updated" | "name";

export interface CatalogFilter {
  category?: string;
  type?: Application["type"] | "all";
  listing?: Application["listing"] | "all";
  reviewStatus?: string | "all";
  offline?: boolean;
}

export class Catalog {
  constructor(private readonly applications: Application[]) {}

  all(): Application[] {
    return [...this.applications];
  }

  search(q: string): Application[] {
    const x = q.trim().toLowerCase();
    if (!x) return this.all();
    return this.applications.filter((a) =>
      [
        a.name,
        a.description,
        a.category,
        a.publisher.name,
        a.license,
        a.type,
        ...(a.metadata?.tags ?? [])
      ].join(" ").toLowerCase().includes(x)
    );
  }

  byCategory(category: string): Application[] {
    return category === "All"
      ? this.all()
      : this.applications.filter((a) => a.category === category);
  }

  filter(filter: CatalogFilter = {}): Application[] {
    return this.applications.filter((app) => {
      if (filter.category && filter.category !== "All" && app.category !== filter.category) return false;
      if (filter.type && filter.type !== "all" && app.type !== filter.type) return false;
      if (filter.listing && filter.listing !== "all" && app.listing !== filter.listing) return false;
      if (filter.reviewStatus && filter.reviewStatus !== "all" && (app.metadata?.reviewStatus ?? "unverified") !== filter.reviewStatus) return false;
      if (filter.offline === true && app.metadata?.offline !== true) return false;
      return true;
    });
  }

  sort(apps: Application[], sort: CatalogSort): Application[] {
    return [...apps].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "updated") return (b.metadata?.lastUpdated ?? "").localeCompare(a.metadata?.lastUpdated ?? "");
      if (sort === "newest") return b.version.localeCompare(a.version, undefined, { numeric: true });
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  find(id: string): Application | undefined {
    return this.applications.find((a) => a.id === id);
  }
}
