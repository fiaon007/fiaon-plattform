/**
 * ============================================================================
 * ARAS COMMAND CENTER - CONTRACT ROUTES (INTERNAL/STAFF)
 * ============================================================================
 * Internal endpoints for contract viewing and approval
 * - View assigned contracts
 * - View PDF
 * - Approve contracts with typed signature
 * ============================================================================
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireInternal } from '../../middleware/role-guard';
import * as contractService from '../../services/contract.service';
import { activityService } from '../../services/activity.service';
import { sendEmail, APP_BASE_URL } from '../../email/mailer';
import { logger } from '../../logger';

const router = Router();

// Compliance email recipient
const COMPLIANCE_EMAIL = 'law@schwarzott-global.com';
const EMAIL_FROM_NAME = 'ARAS AI Platform';

// ============================================================================
// STAFF: GET MY CONTRACTS
// ============================================================================

router.get('/', requireInternal, async (req: any, res) => {
  try {
    const userId = req.user?.id || req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const contracts = contractService.getContractsForUser(userId);
    res.json(contracts);
  } catch (error: any) {
    logger.error('[INTERNAL-CONTRACTS] Error listing contracts:', error.message);
    res.status(500).json({ error: 'Failed to list contracts' });
  }
});

// ============================================================================
// STAFF: GET SINGLE CONTRACT (if assigned)
// ============================================================================

router.get('/:id', requireInternal, async (req: any, res) => {
  try {
    const userId = req.user?.id || req.session?.userId;
    const userRole = req.user?.userRole || req.session?.userRole;
    
    const contract = contractService.getContractById(req.params.id);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Check access: must be assigned user or admin
    if (contract.assignedUserId !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(contract);
  } catch (error: any) {
    logger.error('[INTERNAL-CONTRACTS] Error getting contract:', error.message);
    res.status(500).json({ error: 'Failed to get contract' });
  }
});

// ============================================================================
// STAFF: SERVE PDF (if assigned or admin)
// ============================================================================

router.get('/:id/pdf', requireInternal, async (req: any, res) => {
  try {
    const userId = req.user?.id || req.session?.userId;
    const userRole = req.user?.userRole || req.session?.userRole;
    
    const contract = contractService.getContractById(req.params.id);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Check access: must be assigned user or admin
    if (contract.assignedUserId !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const filePath = contractService.getContractFilePath(req.params.id);
    if (!filePath) {
      return res.status(404).json({ error: 'Contract file not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${contract.filename}"`);
    res.sendFile(filePath);
  } catch (error: any) {
    logger.error('[INTERNAL-CONTRACTS] Error serving PDF:', error.message);
    res.status(500).json({ error: 'Failed to serve PDF' });
  }
});

// ============================================================================
// STAFF: APPROVE CONTRACT
// ============================================================================

const approveSchema = z.object({
  typedSignature: z.string()
    .min(6, 'Signature must be at least 6 characters')
    .refine(val => val === val.toUpperCase(), {
      message: 'Signature must be in CAPITAL LETTERS',
    }),
  confirm: z.boolean().refine(val => val === true, {
    message: 'You must confirm you have read the contract',
  }),
});

router.post('/:id/approve', requireInternal, async (req: any, res) => {
  try {
    const userId = req.user?.id || req.session?.userId;
    const username = req.user?.username || req.session?.username || 'Unknown';
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Validate body
    const validation = approveSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.flatten() 
      });
    }

    const { typedSignature } = validation.data;

    // Get contract first
    const contract = contractService.getContractById(req.params.id);
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Check assignment
    if (contract.assignedUserId !== userId) {
      return res.status(403).json({ error: 'Not assigned to this contract' });
    }

    // Get IP and user agent for audit
    const ipAddress = req.headers['x-forwarded-for']?.toString().split(',')[0] || 
                      req.socket?.remoteAddress || 
                      'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    // Approve contract
    const result = contractService.approveContract({
      contractId: req.params.id,
      userId,
      username,
      typedSignature,
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Log activity
    try {
      await activityService.log({
        actorId: userId,
        actorName: username,
        actorRole: 'staff',
        actionKey: 'CONTRACT_APPROVED',
        targetType: 'contract',
        targetId: contract.id,
        targetName: contract.title,
        description: `Contract "${contract.title}" approved by ${username}`,
        metadata: { 
          contractId: contract.id, 
          typedSignature,
          approvedAt: result.contract?.approval?.approvedAt,
        },
      });
    } catch (e) {
      // Activity logging should never block
    }

    // Send compliance email
    try {
      await sendComplianceEmail(result.contract!, username);
    } catch (emailError: any) {
      logger.error('[INTERNAL-CONTRACTS] Failed to send compliance email:', emailError.message);
      // Don't fail the request if email fails
    }

    logger.info(`[INTERNAL-CONTRACTS] Approved: ${req.params.id} by ${username}`);
    res.json({ 
      success: true, 
      contract: result.contract,
      message: 'Contract approved successfully. Compliance has been notified.',
    });
  } catch (error: any) {
    logger.error('[INTERNAL-CONTRACTS] Error approving contract:', error.message);
    res.status(500).json({ error: 'Failed to approve contract' });
  }
});

// ============================================================================
// COMPLIANCE EMAIL
// ============================================================================

async function sendComplianceEmail(
  contract: contractService.Contract,
  approverUsername: string
): Promise<void> {
  const adminUrl = `${APP_BASE_URL}/admin/contracts?contractId=${contract.id}`;
  const approvedAt = contract.approval?.approvedAt 
    ? new Date(contract.approval.approvedAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })
    : 'Unknown';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ff6a00 0%, #ff8c3a 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border: 1px solid #e0e0e0; border-top: none; }
        .field { margin-bottom: 12px; }
        .label { font-weight: 600; color: #666; font-size: 12px; text-transform: uppercase; }
        .value { font-size: 14px; margin-top: 4px; }
        .signature { font-family: monospace; font-size: 16px; background: #fff; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; }
        .button { display: inline-block; background: #ff6a00; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px; }
        .footer { text-align: center; padding: 16px; color: #999; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 20px;">ARAS AI — Contract Approved</h1>
        </div>
        <div class="content">
          <p>A contract has been approved and requires your records.</p>
          
          <div class="field">
            <div class="label">Contract Title</div>
            <div class="value">${contract.title}</div>
          </div>
          
          <div class="field">
            <div class="label">Contract ID</div>
            <div class="value" style="font-family: monospace;">${contract.id}</div>
          </div>
          
          <div class="field">
            <div class="label">Approved By</div>
            <div class="value">${approverUsername}</div>
          </div>
          
          <div class="field">
            <div class="label">Typed Signature</div>
            <div class="signature">${contract.approval?.typedSignature || 'N/A'}</div>
          </div>
          
          <div class="field">
            <div class="label">Approved At</div>
            <div class="value">${approvedAt} (CET)</div>
          </div>
          
          <div class="field">
            <div class="label">IP Address</div>
            <div class="value" style="font-family: monospace;">${contract.approval?.ipAddress || 'N/A'}</div>
          </div>
          
          <a href="${adminUrl}" class="button">View in Admin Panel →</a>
        </div>
        <div class="footer">
          <p>This is an automated notification from ARAS AI Platform.</p>
          <p>Contract approval audit trail ID: ${contract.id}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
ARAS AI — Contract Approved

Contract Title: ${contract.title}
Contract ID: ${contract.id}
Approved By: ${approverUsername}
Typed Signature: ${contract.approval?.typedSignature || 'N/A'}
Approved At: ${approvedAt} (CET)
IP Address: ${contract.approval?.ipAddress || 'N/A'}

View in Admin Panel: ${adminUrl}

---
This is an automated notification from ARAS AI Platform.
Contract approval audit trail ID: ${contract.id}
  `.trim();

  await sendEmail({
    to: COMPLIANCE_EMAIL,
    subject: `Contract approved — ${approverUsername} — ${contract.title}`,
    html,
    text,
    tags: [
      { name: 'type', value: 'contract-approval' },
      { name: 'contract_id', value: contract.id },
    ],
  });

  logger.info(`[INTERNAL-CONTRACTS] Compliance email sent for contract ${contract.id}`);
}

export default router;
