import type { FastifyInstance } from "fastify";
import { env } from "../config/env";
import { getAuthService, SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE_SECONDS } from "../services/auth";

interface LoginBody {
  username: string;
  password: string;
}

function cookieOptions() {
  return {
    httpOnly: true,
    path: "/",
    secure: env.isProduction,
    sameSite: (env.isProduction ? "none" : "lax") as "none" | "lax",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS
  };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: LoginBody }>("/api/auth/login", async (request, reply) => {
    const { username, password } = request.body ?? {};
    if (!username || !password) {
      return reply.code(400).send({ error: "username_password_required" });
    }

    const authService = getAuthService();
    const valid = await authService.checkCredentials(username, password);
    if (!valid) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }

    const token = authService.createSessionToken(username);
    reply.setCookie(SESSION_COOKIE_NAME, token, cookieOptions());
    return { authenticated: true };
  });

  app.post("/api/auth/logout", async (_request, reply) => {
    reply.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    return { ok: true };
  });

  app.get("/api/auth/me", async (request) => {
    const token = request.cookies[SESSION_COOKIE_NAME];
    if (!token) return { authenticated: false };

    try {
      return { authenticated: getAuthService().verifySessionToken(token) };
    } catch {
      return { authenticated: false };
    }
  });
}
