import type { Application } from '../models/App';
export class Catalog {
  constructor(private readonly applications: Application[]) {}
  all() { return [...this.applications]; }
  search(q: string) { const x=q.trim().toLowerCase(); if(!x)return this.all(); return this.applications.filter(a => [a.name,a.description,a.category,a.publisher.name].join(' ').toLowerCase().includes(x)); }
  byCategory(c: string) { return c==='All' ? this.all() : this.applications.filter(a=>a.category===c); }
  find(id: string) { return this.applications.find(a=>a.id===id); }
}
