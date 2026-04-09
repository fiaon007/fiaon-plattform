import { Router } from "express";
import { db } from "../db";
import { logger } from "../logger";
import postgres from "postgres";
import * as schema from "@shared/schema";

const router = Router();

// Get all database tables
router.get("/tables", async (req, res) => {
  try {
    const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });
    
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    
    await sql.end();
    
    res.json({ tables: tables.map((t: any) => t.table_name) });
  } catch (error) {
    logger.error("[ADMIN-DATABASE] Error fetching tables:", error);
    res.status(500).json({ error: "Failed to fetch tables" });
  }
});

// Get table structure
router.get("/tables/:tableName/structure", async (req, res) => {
  try {
    const { tableName } = req.params;
    const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });
    
    const columns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = ${sql(tableName)} 
      AND table_schema = 'public'
      ORDER BY ordinal_position;
    `;
    
    await sql.end();
    
    res.json({ columns });
  } catch (error) {
    logger.error("[ADMIN-DATABASE] Error fetching table structure:", error);
    res.status(500).json({ error: "Failed to fetch table structure" });
  }
});

// Get table data with pagination
router.get("/tables/:tableName/data", async (req, res) => {
  try {
    const { tableName } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    
    const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });
    
    // Get total count
    const [countResult] = await sql`
      SELECT COUNT(*) as total FROM ${sql.unsafe(tableName)};
    `;
    
    // Get data
    const data = await sql`
      SELECT * FROM ${sql.unsafe(tableName)}
      ORDER BY id DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset};
    `;
    
    await sql.end();
    
    res.json({
      data,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.total),
        totalPages: Math.ceil(parseInt(countResult.total) / limit)
      }
    });
  } catch (error) {
    logger.error("[ADMIN-DATABASE] Error fetching table data:", error);
    res.status(500).json({ error: "Failed to fetch table data" });
  }
});

// Get database statistics
router.get("/stats", async (req, res) => {
  try {
    const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });
    
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    
    const stats = [];
    
    for (const table of tables) {
      const [countResult] = await sql`
        SELECT COUNT(*) as total FROM ${sql.unsafe(`"${table.table_name}"`)};
      `;
      
      const [sizeResult] = await sql`
        SELECT pg_size_pretty(pg_total_relation_size(${sql.unsafe(`"${table.table_name}"`)})) as size;
      `;
      
      stats.push({
        table: table.table_name,
        rows: parseInt(countResult.total),
        size: sizeResult.size
      });
    }
    
    await sql.end();
    
    res.json({ stats });
  } catch (error) {
    logger.error("[ADMIN-DATABASE] Error fetching database stats:", error);
    res.status(500).json({ error: "Failed to fetch database stats" });
  }
});

export default router;
