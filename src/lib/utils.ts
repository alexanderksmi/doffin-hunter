import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalizes a domain name for consistent matching
 * - Converts to lowercase
 * - Removes www prefix
 * - Trims whitespace
 * - Removes trailing dots
 */
export function normalizeDomain(domain: string): string {
  return domain
    .toLowerCase()
    .trim()
    .replace(/^www\./i, '')
    .replace(/\.+$/, '');
}
