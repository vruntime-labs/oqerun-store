import { permissionDefinitions } from "../models/Permission";

export class PermissionManager {
  validate(requested: string[]): string[] {
    const known = new Set(permissionDefinitions.map((permission) => permission.id));
    return requested.filter((permission) => known.has(permission));
  }

  unknown(requested: string[]): string[] {
    const known = new Set(permissionDefinitions.map((permission) => permission.id));
    return requested.filter((permission) => !known.has(permission));
  }
}
