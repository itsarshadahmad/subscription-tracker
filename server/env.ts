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

export const env = {
  databaseUrl: process.env.DATABASE_URL!,
  sessionSecret: process.env.SESSION_SECRET!,
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number.parseInt(process.env.PORT ?? "5000", 10),
  trustProxy: process.env.TRUST_PROXY ?? "1",
};
