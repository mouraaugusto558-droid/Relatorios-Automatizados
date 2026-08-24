import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const SESSION_COOKIE_NAME = "session";
export const SESSION_COOKIE_MAX_AGE_SECONDS = 12 * 60 * 60;

export interface AuthConfig {
  username: string;
  passwordHash: string;
  secret: string;
}

export interface AuthService {
  checkCredentials(username: string, password: string): Promise<boolean>;
  createSessionToken(username: string): string;
  verifySessionToken(token: string): boolean;
}

interface SessionTokenPayload {
  username: string;
}

export function createAuthService(config: AuthConfig): AuthService {
  return {
    async checkCredentials(username: string, password: string): Promise<boolean> {
      if (username !== config.username) return false;
      return bcrypt.compare(password, config.passwordHash);
    },

    createSessionToken(username: string): string {
      const payload: SessionTokenPayload = { username };
      return jwt.sign(payload, config.secret, { expiresIn: SESSION_COOKIE_MAX_AGE_SECONDS });
    },

    verifySessionToken(token: string): boolean {
      try {
        const decoded = jwt.verify(token, config.secret) as SessionTokenPayload;
        return decoded.username === config.username;
      } catch {
        return false;
      }
    }
  };
}
