// Standalone Authentication System - No external dependencies
// This replaces the Replit OAuth system for client deployment

import type { Express } from "express";

export async function setupAuth(app: Express) {
  // Placeholder function - actual auth setup is in simple-auth.ts
  console.log("Using standalone authentication system");
}

// Compatibility export for existing code
export const isAuthenticated = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};