import type { Application } from '../models/App';
import type { InstallationProvider } from '../providers/InstallationProvider';
export class InstallManager { constructor(private readonly providers:InstallationProvider[]){} async install(a:Application){const p=this.providers.find(x=>x.supports(a)); if(!p)throw new Error('No installation provider supports '+a.type+'.'); await p.install(a);} }
