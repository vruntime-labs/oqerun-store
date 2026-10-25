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

    if (!app.id || !app.name || !app.version) errors.push("Application identity is incomplete.");
    if (!app.publisher.name) errors.push("Publisher information is missing.");
    if (app.source.type === "github" && !app.source.repository) errors.push("GitHub source is missing its repository.");
    if (!app.license) warnings.push("No license is declared.");
    if (!app.compatibility?.minimumOqerunVersion) warnings.push("Oqerun compatibility is not declared.");

    if (app.installation.url) {
      try {
        const url = new URL(app.installation.url);
        if (url.protocol !== "https:" && url.hostname !== "localhost") warnings.push("Installation URL is not HTTPS.");
      } catch {
        errors.push("Installation URL is invalid.");
      }
    } else if (app.type !== "oqpkg") {
      warnings.push("No launch or installation URL is published.");
    }

    if (app.type === "oqpkg" && !app.installation.url) {
      warnings.push("Native .oqpkg installation requires an Oqerun OS-side source resolver.");
    }

    if (!app.publisher.verified) warnings.push("Publisher is not verified by the Store.");
    if ((app.metadata?.reviewStatus ?? "unverified") === "unverified") warnings.push("This listing has not been independently reviewed by the Store.");
    if (app.installation.sha256) {
      if (!/^[a-f0-9]{64}$/i.test(app.installation.sha256)) errors.push("Published SHA-256 value is invalid.");
    } else if (app.type === "oqpkg" || app.installation.downloadUrl) {
      warnings.push("No SHA-256 digest is published. The download cannot be verified by the Store.");
    }
    if (app.permissions.length > 0) warnings.push("Review requested permissions before installation.");

    return { valid: errors.length === 0, warnings, errors };
  }
}
