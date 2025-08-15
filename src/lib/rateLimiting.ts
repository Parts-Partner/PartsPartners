// src/lib/rateLimiting.ts
// =============================================================================
// RATE LIMITING SYSTEM FOR PARTS PARTNERS
// =============================================================================

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  message?: string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked: boolean;
}

class RateLimiter {
  private requests: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;
  private cleanupInterval: number;

  constructor(config: RateLimitConfig) {
    this.config = {
      message: 'Too many requests. Please slow down.',
      ...config
    };

    // Clean up expired entries every 5 minutes
    this.cleanupInterval = window.setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000) as unknown as number;
  }

  canMakeRequest(key: string): { allowed: boolean; remaining: number; resetTime: number; message?: string } {
    const now = Date.now();
    const entry = this.requests.get(key);

    // If no entry exists, create one
    if (!entry) {
      this.requests.set(key, {
        count: 1,
        resetTime: now + this.config.windowMs,
        blocked: false
      });
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime: now + this.config.windowMs
      };
    }

    // If window has expired, reset the counter
    if (now >= entry.resetTime) {
      entry.count = 1;
      entry.resetTime = now + this.config.windowMs;
      entry.blocked = false;
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime: entry.resetTime
      };
    }

    // Check if already blocked
    if (entry.blocked) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        message: this.config.message
      };
    }

    // Increment counter
    entry.count++;

    // Check if limit exceeded
    if (entry.count > this.config.maxRequests) {
      entry.blocked = true;
      console.warn(`🚫 Rate limit exceeded for key: ${key} (${entry.count}/${this.config.maxRequests})`);
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        message: this.config.message
      };
    }

    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.count,
      resetTime: entry.resetTime
    };
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    // Convert to array first to avoid iterator issues
    const entries = Array.from(this.requests.entries());
    
    for (const [key, entry] of entries) {
      if (now >= entry.resetTime) {
        this.requests.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Rate limiter cleanup: Removed ${cleaned} expired entries`);
    }
  }

  getStats(): { totalKeys: number; blockedKeys: number; memoryUsage: string } {
    let blocked = 0;
    
    // Convert to array first for better TypeScript compatibility
    const values = Array.from(this.requests.values());
    
    for (const entry of values) {
      if (entry.blocked) blocked++;
    }

    return {
      totalKeys: this.requests.size,
      blockedKeys: blocked,
      memoryUsage: `${Math.round(this.requests.size * 0.1)}KB` // Rough estimate
    };
  }

  destroy(): void {
    window.clearInterval(this.cleanupInterval);
    this.requests.clear();
  }
}

// =============================================================================
// RATE LIMIT CONFIGURATIONS
// =============================================================================

// Search rate limiting (most important)
export const searchLimiter = new RateLimiter({
  maxRequests: 60, // 60 searches per minute
  windowMs: 60 * 1000, // 1 minute window
  message: 'Too many searches. Please wait a moment before searching again.'
});

// Bulk operations rate limiting
export const bulkLimiter = new RateLimiter({
  maxRequests: 10, // 10 bulk operations per minute
  windowMs: 60 * 1000,
  message: 'Too many bulk operations. Please wait before processing more orders.'
});

// Authentication rate limiting
export const authLimiter = new RateLimiter({
  maxRequests: 5, // 5 login attempts per minute
  windowMs: 60 * 1000,
  message: 'Too many login attempts. Please wait before trying again.'
});

// Suggestions/autocomplete rate limiting (more lenient)
export const suggestionsLimiter = new RateLimiter({
  maxRequests: 120, // 120 suggestions per minute (2 per second)
  windowMs: 60 * 1000,
  message: 'Too many suggestion requests. Please slow down your typing.'
});

// General API rate limiting (catch-all)
export const generalLimiter = new RateLimiter({
  maxRequests: 100, // 100 requests per minute
  windowMs: 60 * 1000,
  message: 'Too many requests. Please slow down.'
});

// =============================================================================
// USER IDENTIFICATION UTILITIES
// =============================================================================

// Get unique identifier for rate limiting
export function getRateLimitKey(type: 'search' | 'bulk' | 'auth' | 'suggestions' | 'general', userId?: string): string {
  // For logged-in users, use their user ID
  if (userId) {
    return `${type}:user:${userId}`;
  }

  // For anonymous users, try to get a fingerprint
  const fingerprint = getClientFingerprint();
  return `${type}:anon:${fingerprint}`;
}

// Simple client fingerprinting (not perfect, but good enough)
function getClientFingerprint(): string {
  if (typeof window === 'undefined') return 'server';

  // Combine multiple browser characteristics
  const components = [
    navigator.userAgent || '',
    navigator.language || '',
    screen.width || 0,
    screen.height || 0,
    new Date().getTimezoneOffset(),
    // Add more characteristics as needed
  ];

  // Simple hash function
  let hash = 0;
  const str = components.join('|');
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(36);
}

// =============================================================================
// RATE LIMITING ERROR CLASS
// =============================================================================

export class RateLimitError extends Error {
  constructor(
    message: string,
    public remaining: number,
    public resetTime: number,
    public retryAfter: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }

  getRetryAfterSeconds(): number {
    return Math.ceil(this.retryAfter / 1000);
  }

  getRetryAfterHuman(): string {
    const seconds = this.getRetryAfterSeconds();
    if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
}

// =============================================================================
// RATE LIMITING MIDDLEWARE FUNCTIONS
// =============================================================================

// Check rate limit and throw error if exceeded
export function checkRateLimit(
  limiter: RateLimiter,
  key: string
): void {
  const result = limiter.canMakeRequest(key);

  if (!result.allowed) {
    const retryAfter = result.resetTime - Date.now();
    throw new RateLimitError(
      result.message || 'Rate limit exceeded',
      result.remaining,
      result.resetTime,
      retryAfter
    );
  }
}

// Safe rate limit check that returns boolean
export function isRateLimited(
  limiter: RateLimiter,
  key: string
): { limited: boolean; remaining: number; retryAfter?: number } {
  const result = limiter.canMakeRequest(key);

  if (!result.allowed) {
    return {
      limited: true,
      remaining: result.remaining,
      retryAfter: result.resetTime - Date.now()
    };
  }

  return {
    limited: false,
    remaining: result.remaining
  };
}

// =============================================================================
// MONITORING AND ANALYTICS
// =============================================================================

export const rateLimitMonitor = {
  // Get statistics for all limiters
  getAllStats: () => ({
    search: searchLimiter.getStats(),
    bulk: bulkLimiter.getStats(),
    auth: authLimiter.getStats(),
    suggestions: suggestionsLimiter.getStats(),
    general: generalLimiter.getStats()
  }),

  // Log rate limit violations for analysis
  logViolation: (type: string, key: string, userAgent?: string) => {
    console.warn(`🚫 Rate limit violation:`, {
      type,
      key: key.substring(0, 20) + '...', // Truncate for privacy
      userAgent: userAgent?.substring(0, 50),
      timestamp: new Date().toISOString()
    });

    // Here you could send to analytics service
    // analytics.track('rate_limit_violation', { type, timestamp: Date.now() });
  },

  // Get current load information
  getCurrentLoad: () => {
    const stats = rateLimitMonitor.getAllStats();
    const totalActive = Object.values(stats).reduce((sum, stat) => sum + stat.totalKeys, 0);
    const totalBlocked = Object.values(stats).reduce((sum, stat) => sum + stat.blockedKeys, 0);

    return {
      totalActiveUsers: totalActive,
      totalBlockedUsers: totalBlocked,
      blockRate: totalActive > 0 ? (totalBlocked / totalActive) * 100 : 0
    };
  }
};

// =============================================================================
// RATE LIMIT ERROR HANDLING UTILITIES
// =============================================================================

export const rateLimitUtils = {
  // Handle rate limit errors gracefully in UI
  handleRateLimitError: (error: RateLimitError): string => {
    const retryTime = error.getRetryAfterHuman();
    return `Please slow down! You can try again in ${retryTime}.`;
  },

  // Check if an error is a rate limit error
  isRateLimitError: (error: any): error is RateLimitError => {
    return error instanceof RateLimitError;
  },

  // Get user-friendly rate limit message
  getRateLimitMessage: (type: 'search' | 'bulk' | 'suggestions', error: RateLimitError): string => {
    const retryTime = error.getRetryAfterHuman();
    
    switch (type) {
      case 'search':
        return `You're searching too quickly! Please wait ${retryTime} before searching again.`;
      case 'bulk':
        return `Please wait ${retryTime} before processing another bulk order.`;
      case 'suggestions':
        return `Please slow down your typing. Suggestions will resume in ${retryTime}.`;
      default:
        return `Please wait ${retryTime} before trying again.`;
    }
  },

  // Show rate limit notification (integrate with your UI notification system)
  showRateLimitNotification: (type: 'search' | 'bulk' | 'suggestions', error: RateLimitError) => {
    const message = rateLimitUtils.getRateLimitMessage(type, error);
    
    // Option 1: Console warning (current implementation)
    console.warn(`🚫 Rate Limited: ${message}`);
    
    // Option 2: Browser notification (if you want to be more user-friendly)
    // alert(message);
    
    // Option 3: Toast notification (if you have a toast system)
    // toast.warning(message);
    
    // Option 4: Custom UI notification (recommended)
    // You can dispatch a custom event for your UI to handle
    window.dispatchEvent(new CustomEvent('pp:rateLimited', {
      detail: { type, message, retryAfter: error.getRetryAfterSeconds() }
    }));
  }
}

// =============================================================================
// CLEANUP ON APP SHUTDOWN
// =============================================================================

// Clean up rate limiters when app shuts down
export function cleanupRateLimiters(): void {
  searchLimiter.destroy();
  bulkLimiter.destroy();
  authLimiter.destroy();
  suggestionsLimiter.destroy();
  generalLimiter.destroy();
  console.log('🧹 Rate limiters cleaned up');
}

// Auto-cleanup in browser environments
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', cleanupRateLimiters);
}