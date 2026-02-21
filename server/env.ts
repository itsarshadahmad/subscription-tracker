import fs from "fs";
import path from "path";

function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

const requiredVars = ["DATABASE_URL", "SESSION_SECRET"] as const;

function validateEnv() {
  const missing = requiredVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. See .env.example for setup.`,
    );
  }
}

validateEnv();

const defaultNodeEnv =
  process.argv[1]?.includes(`${path.sep}dist${path.sep}`) ||
  process.argv[1]?.endsWith("dist/index.cjs")
    ? "production"
    : "development";

export const env = {
  databaseUrl: process.env.DATABASE_URL!,
  sessionSecret: process.env.SESSION_SECRET!,
  nodeEnv: process.env.NODE_ENV ?? defaultNodeEnv,
  port: Number.parseInt(process.env.PORT ?? "5000", 10),
  trustProxy: process.env.TRUST_PROXY ?? "1",
};
