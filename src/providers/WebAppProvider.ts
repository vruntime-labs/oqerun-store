import type { Application } from '../models/App';
import type { InstallationProvider } from './InstallationProvider';
export class WebAppProvider implements InstallationProvider { supports(a:Application){return a.type==='web';} async install(_a:Application):Promise<void>{throw new Error('Web application installation is not connected yet.');} }
