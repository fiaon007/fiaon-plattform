// Production-ready logging utility
const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  info: (message: string, data?: any) => {
    // Always log in production for critical debugging
    console.log(`${message}`, data !== undefined ? data : '');
  },
  
  error: (message: string, error?: any) => {
    console.error(`${message}`, error || '');
  },
  
  warn: (message: string, data?: any) => {
    // Always log warnings in production
    console.warn(`${message}`, data !== undefined ? data : '');
  },
  
  debug: (message: string, data?: any) => {
    // Only in development for verbose debugging
    if (isDevelopment) {
      console.debug(`[DEBUG] ${message}`, data || '');
    }
  }
};