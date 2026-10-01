import type { ApplicationType } from "./App";

export interface OqpkgManifest {
  id: string;
  name: string;
  version: string;
  publisher: string;
  type: "oqpkg";
  entry: string;
  runtime: string;
  minimumOqerunVersion: string;
  permissions: string[];
  fileAssociations?: string[];
  integrity?: {
    algorithm: "sha256";
    digest: string;
  };
}

export interface ApplicationPackage {
  applicationId: string;
  type: ApplicationType;
  version: string;
  sourceUrl: string;
  sha256?: string;
}
