/**
 * Native intent handler — controls how deep links map to the initial route.
 *
 * Previously this redirected ALL incoming paths to "/", which silently
 * swallowed the OAuth callback URL (rork-<projectId>://auth/callback?code=...)
 * when the app was cold-launched from a Google/Apple sign-in redirect,
 * causing the auth code to be lost before the Linking handler could process it.
 *
 * Now we only redirect unknown/empty paths to the home route, and let the
 * auth callback path pass through so useAuth's Linking.getInitialURL() /
 * addEventListener("url") handler can extract the authorization code.
 */
export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string {
  // Let the auth callback reach the app's deep-link handler untouched.
  if (path.startsWith("/auth/callback")) {
    return path;
  }
  return "/";
}
