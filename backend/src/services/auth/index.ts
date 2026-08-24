import { env } from "../../config/env";
import { createAuthService, type AuthService } from "./authService";

let service: AuthService | null = null;

export function getAuthService(): AuthService {
  if (!service) {
    if (!env.authUsername || !env.authPasswordHash || !env.authSessionSecret) {
      throw new Error("AUTH_USERNAME, AUTH_PASSWORD_HASH e AUTH_SESSION_SECRET precisam estar configurados no .env");
    }
    service = createAuthService({
      username: env.authUsername,
      passwordHash: env.authPasswordHash,
      secret: env.authSessionSecret
    });
  }
  return service;
}

export { SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE_SECONDS } from "./authService";
export type { AuthService } from "./authService";
