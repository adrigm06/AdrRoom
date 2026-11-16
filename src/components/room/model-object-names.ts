/** GLTFLoader replaces source-name whitespace with underscores. */
export function normalizeRoomObjectName(name: string): string {
  return name.toLowerCase().replace(/[_|]+/g, ' ').replace(/\s+/g, ' ').trim();
}
