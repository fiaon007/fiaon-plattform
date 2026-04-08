// Production-ready performance monitoring and optimization utilities
import { client as pool } from './db';
import { logger } from './logger';
import type { Request, Response, NextFunction } from 'express';

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private queryTimes: Map<string, number[]> = new Map();
  
  private constructor() {}
  
  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }
  
  // Track API response times
  trackQuery(queryName: string, duration: number): void {
    if (!this.queryTimes.has(queryName)) {
      this.queryTimes.set(queryName, []);
    }
    
    const times = this.queryTimes.get(queryName)!;
    times.push(duration);
    
    // Keep only last 100 measurements
    if (times.length > 100) {
      times.shift();
    }
    
    // Log slow queries (>1000ms)
    if (duration > 1000) {
      logger.warn(`Slow query detected: ${queryName} took ${duration}ms`);
    }
  }
  
  // Get performance statistics
  getStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    this.queryTimes.forEach((times, queryName) => {
      if (times.length > 0) {
        const avg = times.reduce((a: number, b: number) => a + b, 0) / times.length;
        const max = Math.max(...times);
        const min = Math.min(...times);
        
        stats[queryName] = {
          count: times.length,
          average: Math.round(avg),
          max,
          min,
          recent: times.slice(-10) // Last 10 measurements
        };
      }
    });
    
    return stats;
  }
  
  // Database health check
  async checkDatabaseHealth(): Promise<any> {
    try {
      const client = await pool.connect();
      const start = Date.now();
      
      await client.query('SELECT 1');
      const connectionTime = Date.now() - start;
      
      // Check connection pool stats
      const poolStats = {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      };
      
      client.release();
      
      return {
        status: 'healthy',
        connectionTime,
        poolStats
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Database health check failed:', errorMessage);
      return {
        status: 'unhealthy',
        error: errorMessage
      };
    }
  }
  
  // Memory usage monitoring
  getMemoryUsage(): any {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024), // MB
      arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024) // MB
    };
  }
}

// Express middleware for performance tracking
export function performanceMiddleware() {
  const monitor = PerformanceMonitor.getInstance();
  
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    
    // Track response time
    res.on('finish', () => {
      const duration = Date.now() - start;
      const routeName = `${req.method} ${(req as any).route?.path || req.path}`;
      monitor.trackQuery(routeName, duration);
    });
    
    next();
  };
}