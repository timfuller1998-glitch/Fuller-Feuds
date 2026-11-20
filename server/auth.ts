import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { UserRepository } from "./repositories/userRepository.js";
import { checkHandle, isHandleConflict } from "./lib/handles.js";
import { getSiteConfig } from "./lib/siteSettings.js";
import { clientIp } from "./lib/clientIp.js";
import { claimInviteCode, finalizeInvitedSignup, normalizeCode, releaseInviteCode, type InviteRow } from "./lib/invites.js";

// Sign-up rate limits (founding members, Nov 20 2026), in memory per IP: 20 attempts an hour (slows invite-code
// guessing) and 5 new accounts an hour.
const HOUR = 60 * 60 * 1000;
const signupAttempts = new Map<string, number[]>();
const signupCreated = new Map<string, number[]>();
function recent(map: Map<string, number[]>, ip: string): number[] {
  const now = Date.now();
  const hits = (map.get(ip) || []).filter((t) => now - t < HOUR);
  map.set(ip, hits);
  if (map.size > 5000) map.clear();
  return hits;
}
function allowSignupAttempt(ip: string): boolean {
  const hits = recent(signupAttempts, ip);
  if (hits.length >= 20) return false;
  hits.push(Date.now());
  return true;
}
const canCreateAccount = (ip: string) => recent(signupCreated, ip).length < 5;
const recordAccountCreated = (ip: string) => recent(signupCreated, ip).push(Date.now());
function cleanRef(v: unknown): string | null {
  const s = String(v ?? "").trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 80);
  return s || null;
}

const userRepository = new UserRepository();

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true, // Automatically create sessions table
    ttl: sessionTtl,
    tableName: "sessions",
  });

  if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is required');
  }

  // Determine if we're in a secure environment (HTTPS)
  // In production, requests should be HTTPS
  // Note: This function is called at module load time, so we can't check req.protocol here
  // The secure flag will be evaluated per-request by Express based on trust proxy setting
  const isSecure = process.env.NODE_ENV === "production";
  
  return session({
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    name: 'connect.sid', // Explicit session cookie name
    cookie: {
      httpOnly: true,
      secure: isSecure, // Will be true in production
      maxAge: sessionTtl,
      sameSite: 'lax', // Use 'lax' for better cross-site compatibility
      // Don't set domain - let browser handle it
      // path: '/' is default
    },
  });
}

export async function setupAuth(app: Express) {
  console.log("Setting up local authentication with email/password");

  // Setup session
  app.use(getSession());

  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure passport local strategy
  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
      },
      async (email, password, done) => {
        try {
          const user = await userRepository.findByEmail(email);
          
          if (!user) {
            return done(null, false, { message: "Invalid email or password" });
          }

          if (!user.passwordHash) {
            return done(null, false, { message: "Please set a password for your account" });
          }

          const isValid = await bcrypt.compare(password, user.passwordHash);
          
          if (!isValid) {
            return done(null, false, { message: "Invalid email or password" });
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  // Serialize user to session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: string, done) => {
    try {
      // Pass requestingUserId so sanitizeUserData treats this as self-access and keeps role/status
      const user = await userRepository.findById(id, id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Register endpoint
  app.post("/api/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName, handle } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      if (req.body?.is18Plus !== true) {
        return res.status(400).json({ message: "You must confirm you're 18 or older to join" });
      }
      const ip = clientIp(req);
      if (!allowSignupAttempt(ip) || !canCreateAccount(ip)) {
        return res.status(429).json({ message: "Too many sign-ups from this network. Please try again later." });
      }
      // Founding mode: sign-up needs a single-use invite code (checked before anything else is created).
      const site = await getSiteConfig();
      const inviteCode = normalizeCode(req.body?.inviteCode);
      if (site.foundingMode && !inviteCode) {
        return res.status(403).json({ message: "Fuller Feuds is invite-only right now. Apply at /apply for an invite code.", code: "INVITE_REQUIRED" });
      }

      // Check if user already exists
      const existingUser = await userRepository.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // @handle picked at sign-up (optional for older clients: one is generated from the name if missing)
      let chosenHandle: string | undefined;
      if (handle) {
        const hc = await checkHandle(String(handle));
        if (!hc.valid) return res.status(400).json({ message: `Handle: ${hc.reason}`, suggestion: hc.suggestion });
        if (!hc.available) return res.status(409).json({ message: hc.reason, suggestion: hc.suggestion });
        chosenHandle = hc.handle;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Reserve the invite code last, right before creating the account; released again if creation fails.
      let invite: InviteRow | null = null;
      if (inviteCode) {
        invite = await claimInviteCode(inviteCode);
        if (!invite && site.foundingMode) {
          return res.status(403).json({ message: "That invite code isn't valid or has already been used.", code: "INVITE_INVALID" });
        }
      }

      // Create user
      let user;
      try {
        user = await userRepository.create({
          email,
          passwordHash,
          firstName: firstName || "",
          lastName: lastName || "",
          handle: chosenHandle,
          signupRef: cleanRef(req.body?.ref),
          ageConfirmedAt: new Date(),
        });
      } catch (createErr) {
        if (invite) await releaseInviteCode(invite.id).catch(() => {});
        throw createErr;
      }
      recordAccountCreated(ip);
      let founder: { founderNumber: number | null; codes: string[] } = { founderNumber: null, codes: [] };
      if (invite) {
        try {
          founder = await finalizeInvitedSignup(user.id, invite, { foundingMode: site.foundingMode });
        } catch (e) {
          // The account exists and the code stays used; log so an admin can fix the perks by hand.
          console.error("Founder setup failed after sign-up:", e);
        }
      }

      // Log user in
      req.login(user, (err) => {
        if (err) {
          console.error("Error logging in after registration:", err);
          return res.status(500).json({ message: "Registration successful but login failed" });
        }

        return res.status(201).json({
          message: "Registration successful",
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            handle: user.handle,
          },
          founderNumber: founder.founderNumber,
          inviteCodes: founder.codes,
        });
      });
    } catch (error: any) {
      if (isHandleConflict(error)) return res.status(409).json({ message: "That handle is taken" });
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed", error: error.message });
    }
  });

  // Login endpoint
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        console.error("Login error:", err);
        return res.status(500).json({ message: "Login failed", error: err.message });
      }

      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }

      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error("Error creating session:", loginErr);
          return res.status(500).json({ message: "Login failed" });
        }

        return res.json({
          message: "Login successful",
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
          },
        });
      });
    })(req, res, next);
  });

  // Logout endpoint
  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logout successful" });
    });
  });

  console.log("Local authentication setup complete");
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};

