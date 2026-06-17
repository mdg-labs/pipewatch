/** Derive a URL-safe workspace slug from a display name (pages B2). */
export function slugifyWorkspaceName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    return "";
  }

  return slug.slice(0, 64);
}
