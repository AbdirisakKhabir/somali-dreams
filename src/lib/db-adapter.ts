import { PrismaMariaDb } from "@prisma/adapter-mariadb";

export function getDbAdapter() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  const parsed = new URL(url);
  const socket = parsed.searchParams.get("socket");
  const baseConfig = {
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
    connectTimeout: 30000,
    acquireTimeout: 30000,
  };

  // Handle both TCP and Unix socket DB URLs.
  if (socket) {
    return new PrismaMariaDb({
      ...baseConfig,
      socketPath: socket,
    });
  }

  return new PrismaMariaDb({
    ...baseConfig,
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
  });
}
