import { customAlphabet } from 'nanoid';

// Lowercase alphanumeric, 20 chars — plays nicely with URLs and the
// string-based IDs the plugin/frontend already expect from the Base44 export.
const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 20);

export function newId(prefix: string): string {
  return `${prefix}_${nanoid()}`;
}
