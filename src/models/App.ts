export type ApplicationType = 'oqpkg' | 'pwa' | 'web' | 'wasm' | 'external';
export type ApplicationListing = 'official' | 'community';

export interface Publisher { name: string; verified: boolean; }
export interface ApplicationSource { type: 'github' | 'url'; repository?: string; url?: string; }
export interface InstallationSource { method: ApplicationType; url?: string; sha256?: string; }

export interface Application {
  id: string; name: string; version: string; description: string; category: string; icon: string;
  publisher: Publisher; listing: ApplicationListing; source: ApplicationSource; license: string; type: ApplicationType; featured?: boolean;
  compatibility: { minimumOqerunVersion: string }; installation: InstallationSource; permissions: string[]; fileAssociations?: string[];
}
