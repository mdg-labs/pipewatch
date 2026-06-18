const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const SLUG_MAX_LENGTH = 64;

/** Client-side slug format check — mirrors API `validateSlugFormat` (pages B2, B8). */
export function isValidWorkspaceSlug(slug: string): boolean {
  const trimmed = slug.trim();
  return (
    trimmed.length > 0 &&
    trimmed.length <= SLUG_MAX_LENGTH &&
    SLUG_PATTERN.test(trimmed)
  );
}
