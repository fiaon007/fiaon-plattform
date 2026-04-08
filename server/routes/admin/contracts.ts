/**
 * ============================================================================
 * ARAS COMMAND CENTER - CONTRACT ROUTES (ADMIN)
 * ============================================================================
 * Admin endpoints for contract management
 * - Upload contracts
 * - View all contracts
 * - Manage contract status
 * ============================================================================
 */

import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAdmin } from '../../middleware/admin';
import * as contractService from '../../services/contract.service';
import { activityService } from '../../services/activity.service';
import { db } from '../../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../../logger';

const router = Router();

// Configure multer for PDF uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB max for PDFs
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// ============================================================================
// ADMIN: GET STORAGE STATUS (for warning banners)
// ============================================================================

router.get('/storage-status', requireAdmin, async (req, res) => {
  try {
    const status = contractService.getStorageStatus();
    res.json(status);
  } catch (error: any) {
    logger.error('[ADMIN-CONTRACTS] Error getting storage status:', error.message);
    res.status(500).json({ error: 'Failed to get storage status' });
  }
});

// ============================================================================
// ADMIN: GET ALL CONTRACTS
// ============================================================================

router.get('/', requireAdmin, async (req, res) => {
  try {
    const contracts = contractService.getAllContracts();
    res.json(contracts);
  } catch (error: any) {
    logger.error('[ADMIN-CONTRACTS] Error listing contracts:', error.message);
    res.status(500).json({ error: 'Failed to list contracts' });
  }
});

// ============================================================================
// ADMIN: GET SINGLE CONTRACT
// ============================================================================

router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const contract = contractService.getContractById(req.params.id);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    res.json(contract);
  } catch (error: any) {
    logger.error('[ADMIN-CONTRACTS] Error getting contract:', error.message);
    res.status(500).json({ error: 'Failed to get contract' });
  }
});

// ============================================================================
// ADMIN: UPLOAD NEW CONTRACT
// ============================================================================

const uploadSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  assignedUserId: z.string().min(1, 'Assigned user is required'),
});

router.post('/', requireAdmin, upload.single('pdf'), async (req: any, res) => {
  try {
    // Validate file
    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required' });
    }

    // Validate body
    const validation = uploadSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.flatten() 
      });
    }

    const { title, assignedUserId } = validation.data;

    // Get assigned user info
    const [assignedUser] = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(eq(users.id, assignedUserId))
      .limit(1);

    if (!assignedUser) {
      return res.status(400).json({ error: 'Assigned user not found' });
    }

    // Get admin info
    const adminId = req.user?.id || req.session?.userId;
    const adminName = req.user?.username || 'Admin';

    // Create contract
    const contract = await contractService.createContract({
      title,
      originalFilename: req.file.originalname,
      fileBuffer: req.file.buffer,
      assignedUserId,
      assignedUsername: assignedUser.username,
      uploadedBy: adminId,
      uploadedByName: adminName,
    });

    if (!contract) {
      return res.status(500).json({ error: 'Failed to create contract' });
    }

    // Log activity
    try {
      await activityService.log({
        actorId: adminId,
        actorName: adminName,
        actorRole: 'admin',
        actionKey: 'CONTRACT_UPLOADED',
        targetType: 'contract',
        targetId: contract.id,
        targetName: title,
        description: `Contract "${title}" uploaded for ${assignedUser.username}`,
        metadata: { 
          contractId: contract.id, 
          assignedUserId,
          filename: req.file.originalname 
        },
      });
    } catch (e) {
      // Activity logging should never block main function
    }

    logger.info(`[ADMIN-CONTRACTS] Uploaded: ${contract.id} - ${title}`);
    res.status(201).json(contract);
  } catch (error: any) {
    logger.error('[ADMIN-CONTRACTS] Error uploading contract:', error.message);
    res.status(500).json({ error: 'Failed to upload contract' });
  }
});

// ============================================================================
// ADMIN: DELETE CONTRACT
// ============================================================================

router.delete('/:id', requireAdmin, async (req: any, res) => {
  try {
    const contract = contractService.getContractById(req.params.id);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const success = contractService.deleteContract(req.params.id);
    if (!success) {
      return res.status(500).json({ error: 'Failed to delete contract' });
    }

    // Log activity
    const adminId = req.user?.id || req.session?.userId;
    const adminName = req.user?.username || 'Admin';
    
    try {
      await activityService.log({
        actorId: adminId,
        actorName: adminName,
        actorRole: 'admin',
        actionKey: 'CONTRACT_DELETED',
        targetType: 'contract',
        targetId: contract.id,
        targetName: contract.title,
        description: `Contract "${contract.title}" deleted`,
      });
    } catch (e) {
      // Activity logging should never block
    }

    res.json({ success: true });
  } catch (error: any) {
    logger.error('[ADMIN-CONTRACTS] Error deleting contract:', error.message);
    res.status(500).json({ error: 'Failed to delete contract' });
  }
});

// ============================================================================
// ADMIN: SERVE PDF (admin can view any contract)
// ============================================================================

router.get('/:id/pdf', requireAdmin, async (req, res) => {
  try {
    const contract = contractService.getContractById(req.params.id);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const filePath = contractService.getContractFilePath(req.params.id);
    if (!filePath) {
      return res.status(404).json({ error: 'Contract file not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${contract.filename}"`);
    res.sendFile(filePath);
  } catch (error: any) {
    logger.error('[ADMIN-CONTRACTS] Error serving PDF:', error.message);
    res.status(500).json({ error: 'Failed to serve PDF' });
  }
});

// ============================================================================
// ADMIN: GET STAFF USERS (for assignment dropdown)
// ============================================================================

router.get('/users/staff', requireAdmin, async (req, res) => {
  try {
    const staffUsers = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        userRole: users.userRole,
      })
      .from(users)
      .where(eq(users.userRole, 'staff'));

    // Also include admins for assignment
    const adminUsers = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        userRole: users.userRole,
      })
      .from(users)
      .where(eq(users.userRole, 'admin'));

    res.json([...staffUsers, ...adminUsers]);
  } catch (error: any) {
    logger.error('[ADMIN-CONTRACTS] Error getting staff users:', error.message);
    res.status(500).json({ error: 'Failed to get staff users' });
  }
});

export default router;
