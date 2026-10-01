import type { Application } from "../models/App";

export interface VerificationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

export class Verification {
  verify(app: Application): VerificationResult {
    const warnings: string[] = [];
    const errors: string[] = [];

    if (!app.id || !app.name || !app.version) {
      errors.push("Application identity is incomplete.");
    }

    if (!app.publisher.name) {
      errors.push("Publisher information is missing.");
    }

    if (app.source.type === "github" && !app.source.repository) {
      errors.push("GitHub source is missing its repository.");
    }

    if (app.type === "oqpkg" && !app.installation.url) {
      warnings.push("No package URL is published yet; native installation will require an OS-side source resolver.");
    }

    if (!app.publisher.verified) {
      warnings.push("Publisher is not verified by the Store.");
    }

    return { valid: errors.length === 0, warnings, errors };
  }
}
