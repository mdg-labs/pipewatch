/** User profile returned by `GET /api/v1/users/me` (PRD §6, pages B13). */
export type UserProfile = {
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  github_login: string;
};

/** Body for `PATCH /api/v1/users/me` — only `name` is mutable. */
export type UpdateUserProfileInput = {
  name: string | null;
};
