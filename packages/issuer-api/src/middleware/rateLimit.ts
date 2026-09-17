import rateLimit from 'express-rate-limit';
import { config } from '../config.js';

/** Applied to every auth endpoint to blunt credential stuffing. */
export const authRateLimiter = rateLimit({
  windowMs: config.authRateLimit.windowMs,
  max: config.authRateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many authentication attempts, please try again later',
      },
    });
  },
});
