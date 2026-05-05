function splitName(name: string): { baseName: string; extension: string } {
  const trimmedName = name.trim();
  const normalizedName = trimmedName.length > 0 ? trimmedName : "file";
  const lastDotIndex = normalizedName.lastIndexOf(".");

  if (lastDotIndex <= 0 || lastDotIndex === normalizedName.length - 1) {
    return {
      baseName: normalizedName,
      extension: ""
    };
  }

  return {
    baseName: normalizedName.slice(0, lastDotIndex),
    extension: normalizedName.slice(lastDotIndex)
  };
}

export function resolveSafeName(name: string, existingNames: string[]): string {
  const reservedNames = new Set(existingNames.map((existingName) => existingName.toLowerCase()));
  const { baseName, extension } = splitName(name);
  let attemptName = `${baseName}${extension}`;
  let suffix = 1;

  while (reservedNames.has(attemptName.toLowerCase())) {
    attemptName = `${baseName} (${suffix})${extension}`;
    suffix += 1;
  }

  return attemptName;
}