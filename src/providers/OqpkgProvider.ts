import type { Application } from '../models/App';
import type { InstallationProvider } from './InstallationProvider';
import { InstallationBridge } from '../core/InstallationBridge';

export class OqpkgProvider implements InstallationProvider {
  private readonly bridge = new InstallationBridge();

  supports(a: Application): boolean {
    return a.type === 'oqpkg';
  }

  async install(a: Application): Promise<void> {
    if (!this.bridge.isAvailable()) {
      throw new Error('Native .oqpkg installation is only available inside Oqerun OS.');
    }
    await this.bridge.install(a);
  }
}
