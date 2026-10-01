export type PermissionRisk = "low" | "medium" | "high";

export interface PermissionDefinition {
  id: string;
  label: string;
  description: string;
  risk: PermissionRisk;
}

export const permissionDefinitions: PermissionDefinition[] = [
  { id: "filesystem.read", label: "Read files", description: "Read files exposed through the Oqerun file system.", risk: "medium" },
  { id: "filesystem.write", label: "Write files", description: "Create or modify files exposed through the Oqerun file system.", risk: "medium" },
  { id: "network", label: "Network access", description: "Connect to network resources.", risk: "medium" },
  { id: "notifications", label: "Notifications", description: "Display notifications through Oqerun.", risk: "low" },
  { id: "microphone", label: "Microphone", description: "Access an available microphone.", risk: "high" },
  { id: "camera", label: "Camera", description: "Access an available camera.", risk: "high" }
];
