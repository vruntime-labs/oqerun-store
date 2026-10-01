import type { Application } from '../models/App';
import type { InstallationProvider } from './InstallationProvider';
export class WasmProvider implements InstallationProvider { supports(a:Application){return a.type==='wasm';} async install(_a:Application):Promise<void>{throw new Error('WASM application installation is not connected yet.');} }
