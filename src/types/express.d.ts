import type { AuthContext } from '../modules/auth/domain/session.js';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    role?: AuthContext['role'];
    profileId?: string;
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
    rawBody?: Buffer;
    requestId?: string;
  }
}
