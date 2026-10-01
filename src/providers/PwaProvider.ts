import type { Application } from '../models/App';
import type { InstallationProvider } from './InstallationProvider';
export class PwaProvider implements InstallationProvider { supports(a:Application){return a.type==='pwa';} async install(a:Application):Promise<void>{if(!a.installation.url)throw new Error('This PWA has no installation URL.'); window.open(a.installation.url,'_blank','noopener,noreferrer'); throw new Error('The PWA was opened for inspection. Native Store registration will be connected to Oqerun OS later.');} }
