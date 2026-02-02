import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import session from "express-session";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";
import { type User } from "@shared/schema";

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      profileImageUrl: string | null;
    }
  }
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Local Strategy (email/password)
  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) {
            return done(null, false, { message: "Invalid email or password" });
          }
          if (!user.password) {
            return done(null, false, { message: "Please use social login for this account" });
          }
          const isValid = await bcrypt.compare(password, user.password);
          if (!isValid) {
            return done(null, false, { message: "Invalid email or password" });
          }
          return done(null, {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
          });
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  // Google Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: "/api/auth/google/callback",
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
              return done(null, false, { message: "No email from Google" });
            }
            
            let user = await storage.getUserByEmail(email);
            if (!user) {
              user = await storage.createUser({
                email,
                firstName: profile.name?.givenName || null,
                lastName: profile.name?.familyName || null,
                profileImageUrl: profile.photos?.[0]?.value || null,
                authProvider: "google",
                providerId: profile.id,
                password: null,
              });
            } else if (user.authProvider !== "google" && !user.providerId) {
              // Link Google to existing account
              user = await storage.updateUser(user.id, {
                authProvider: "google",
                providerId: profile.id,
                profileImageUrl: user.profileImageUrl || profile.photos?.[0]?.value || null,
              });
            }
            
            return done(null, {
              id: user!.id,
              email: user!.email,
              firstName: user!.firstName,
              lastName: user!.lastName,
              profileImageUrl: user!.profileImageUrl,
            });
          } catch (error) {
            return done(error);
          }
        }
      )
    );
  }

  // GitHub Strategy
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
          callbackURL: "/api/auth/github/callback",
          scope: ["user:email"],
        },
        async (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
              return done(null, false, { message: "No email from GitHub" });
            }
            
            let user = await storage.getUserByEmail(email);
            if (!user) {
              const nameParts = (profile.displayName || "").split(" ");
              user = await storage.createUser({
                email,
                firstName: nameParts[0] || profile.username || null,
                lastName: nameParts.slice(1).join(" ") || null,
                profileImageUrl: profile.photos?.[0]?.value || null,
                authProvider: "github",
                providerId: profile.id,
                password: null,
              });
            } else if (user.authProvider !== "github" && !user.providerId) {
              // Link GitHub to existing account
              user = await storage.updateUser(user.id, {
                authProvider: "github",
                providerId: profile.id,
                profileImageUrl: user.profileImageUrl || profile.photos?.[0]?.value || null,
              });
            }
            
            return done(null, {
              id: user!.id,
              email: user!.email,
              firstName: user!.firstName,
              lastName: user!.lastName,
              profileImageUrl: user!.profileImageUrl,
            });
          } catch (error) {
            return done(error);
          }
        }
      )
    );
  }

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      done(null, {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
      });
    } catch (error) {
      done(error);
    }
  });

  // Auth routes
  
  // Email/password signup
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      
      if (!email || !password || !firstName) {
        return res.status(400).json({ message: "Email, password, and first name are required" });
      }
      
      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ message: "Email already registered" });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        firstName,
        lastName: lastName || null,
        authProvider: "local",
        providerId: null,
        profileImageUrl: null,
      });
      
      req.login(
        {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
        },
        (err) => {
          if (err) {
            return res.status(500).json({ message: "Login failed after signup" });
          }
          res.json({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
          });
        }
      );
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ message: "Signup failed" });
    }
  });

  // Email/password login
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: "Login failed" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Login failed" });
        }
        res.json(user);
      });
    })(req, res, next);
  });

  // Google OAuth
  app.get("/api/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));
  
  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login?error=google_failed" }),
    (req, res) => {
      res.redirect("/dashboard");
    }
  );

  // GitHub OAuth
  app.get("/api/auth/github", passport.authenticate("github", { scope: ["user:email"] }));
  
  app.get(
    "/api/auth/github/callback",
    passport.authenticate("github", { failureRedirect: "/login?error=github_failed" }),
    (req, res) => {
      res.redirect("/dashboard");
    }
  );

  // Get current user
  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.json(req.user);
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      res.json({ message: "Logged out" });
    });
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};
