function versionParts(version: string): number[] {
  return version.split(".").map((part) => Number.parseInt(part, 10) || 0);
}

export class Compatibility {
  static meetsMinimum(current: string, minimum: string): boolean {
    const a = versionParts(current);
    const b = versionParts(minimum);
    const length = Math.max(a.length, b.length);

    for (let i = 0; i < length; i += 1) {
      const currentPart = a[i] ?? 0;
      const minimumPart = b[i] ?? 0;
      if (currentPart > minimumPart) return true;
      if (currentPart < minimumPart) return false;
    }

    return true;
  }
}
