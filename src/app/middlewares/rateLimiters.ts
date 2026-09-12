import rateLimit from 'express-rate-limit';

// Auth endpoints (login/register/guest-checkout/change-password) — tight limit,
// these are the classic brute-force / credential-stuffing / spam-account targets.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many attempts. Please try again later.',
  },
});

// Order placement — looser than auth, but still capped to blunt bot-driven
// fake-order / stock-drain abuse against a COD-only store.
export const orderRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many orders placed from this device. Please try again later.',
  },
});
