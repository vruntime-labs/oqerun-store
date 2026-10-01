import type { Application } from '../models/App';
import type { InstallationProvider } from './InstallationProvider';
export class OqpkgProvider implements InstallationProvider { supports(a:Application){return a.type==='oqpkg';} async install(_a:Application):Promise<void>{throw new Error('Native .oqpkg installation requires the Oqerun OS installation bridge.');} }
