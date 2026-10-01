import type { Application } from '../models/App';
import type { InstallationProvider } from './InstallationProvider';
export class ExternalProvider implements InstallationProvider { supports(a:Application){return a.type==='external';} async install(_a:Application):Promise<void>{throw new Error('This external application provider is not connected yet.');} }
