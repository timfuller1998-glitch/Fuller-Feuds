// Replit Auth integration from javascript_log_in_with_replit blueprint
import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { UserRepository } from "./repositories/userRepository";

const userRepository = new UserRepository();

// For local development without Replit, allow missing REPLIT_DOMAINS
if (!process.env.REPLIT_DOMAINS && process.env.NODE_ENV !== 'production') {
  console.warn("REPLIT_DOMAINS not set - running in local development mode without Replit auth");
} else if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

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

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  await userRepository.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  // For local development without Replit, use simple session storage
  if (process.env.NODE_ENV !== 'production') {
    console.log("Setting up local development authentication (no Replit)");
    app.use(session({
      secret: process.env.SESSION_SECRET || 'dev-secret-key',
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        secure: false, // Allow HTTP in development
      },
    }));

    // Initialize passport for local development
    app.use(passport.initialize());
    app.use(passport.session());

    // Mock authentication routes for development
    app.get('/api/login', (req, res) => {
      // Create a mock user for development
      const mockUser = {
        claims: {
          sub: 'dev-user-123',
          email: 'dev@example.com',
          name: 'Development User'
        }
      };
      (req as any).login(mockUser, (err: any) => {
        if (err) {
          console.error('Mock login error:', err);
          return res.redirect('/?error=login_failed');
        }
        res.redirect('/');
      });
    });

    app.post('/api/logout', (req, res) => {
      (req as any).logout((err: any) => {
        if (err) {
          console.error('Logout error:', err);
        }
        res.redirect('/');
      });
    });

    return;
  }

  // Production Replit setup (unchanged)
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    try {
      const user = {};
      updateUserSession(user, tokens);
      await upsertUser(tokens.claims());
      console.log('[Auth Verify] User upserted successfully:', tokens.claims()?.sub);
      verified(null, user);
    } catch (error) {
      console.error('[Auth Verify] Error during user upsert:', error);
      verified(error as Error);
    }
  };

  for (const domain of process.env
    .REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    const hostname = req.hostname;
    console.log(`[Auth Login] Hostname: ${hostname}`);
    console.log(`[Auth Login] Available domains: ${process.env.REPLIT_DOMAINS}`);
    
    passport.authenticate(`replitauth:${hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    const hostname = req.hostname;
    console.log(`[Auth Callback] Hostname: ${hostname}`);
    console.log(`[Auth Callback] Available domains: ${process.env.REPLIT_DOMAINS}`);
    
    passport.authenticate(`replitauth:${hostname}`, (err: any, user: any, info: any) => {
      if (err) {
        console.error('[Auth Callback] Error during authentication:', err);
        return res.status(500).json({ 
          message: 'Authentication error',
          error: err.message || 'Unknown error'
        });
      }
      
      if (!user) {
        console.error('[Auth Callback] No user returned, info:', info);
        return res.redirect('/api/login');
      }
      
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error('[Auth Callback] Error during login:', loginErr);
          return res.status(500).json({ 
            message: 'Login error',
            error: loginErr.message || 'Unknown error'
          });
        }
        
        console.log('[Auth Callback] Login successful');
        return res.redirect('/');
      });
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};