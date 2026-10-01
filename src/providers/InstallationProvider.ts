import type { Application } from '../models/App';
export interface InstallationProvider { supports(app: Application): boolean; install(app: Application): Promise<void>; }
