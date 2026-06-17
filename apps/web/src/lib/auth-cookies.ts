/** Cookie names issued by the API auth routes (PRD §7.1). */
export const REFRESH_COOKIE_NAME = "pw_refresh";
export const ACCESS_COOKIE_NAME = "pw_access";

type CookieReader = {
  has: (name: string) => boolean;
};

/** True when either access or refresh auth cookie is present. */
export function hasAuthSession(cookies: CookieReader): boolean {
  return (
    cookies.has(REFRESH_COOKIE_NAME) || cookies.has(ACCESS_COOKIE_NAME)
  );
}
