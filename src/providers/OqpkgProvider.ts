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

    // The OS currently rejects native packages until it can verify and safely
    // extract the actual package bytes. Fail clearly instead of implying that
    // a valid manifest or digest has completed an installation.
    throw new Error(
      'Native .oqpkg installation is temporarily unavailable. Oqerun OS must first verify and safely install the package bytes. Nothing was installed.',
    );
  }
}
