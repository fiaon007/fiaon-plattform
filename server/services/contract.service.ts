/**
 * ============================================================================
 * ARAS COMMAND CENTER - CONTRACT SERVICE
 * ============================================================================
 * File-based contract storage with JSON registry (no DB migration required)
 * Production-safe: atomic writes, error handling, secure serving
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { logger } from '../logger';

// ============================================================================
// TYPES
// ============================================================================

export type ContractStatus = 'uploaded' | 'pending_approval' | 'approved';

export interface ContractApproval {
  userId: string;
  username: string;
  typedSignature: string; // Must be uppercase full name
  approvedAt: string; // ISO timestamp
  ipAddress?: string;
  userAgent?: string;
}

export interface Contract {
  id: string;
  title: string;
  filename: string; // Original filename
  storedFilename: string; // Internal filename (id.pdf)
  assignedUserId: string;
  assignedUsername?: string;
  uploadedBy: string;
  uploadedByName?: string;
  status: ContractStatus;
  approval?: ContractApproval;
  createdAt: string;
  updatedAt: string;
}

interface ContractRegistry {
  version: number;
  contracts: Contract[];
}

// ============================================================================
// CONFIG
// ============================================================================

// Storage paths - configurable via env
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const DATA_DIR = process.env.CONTRACT_DATA_DIR || path.join(process.cwd(), 'data');
const CONTRACTS_DIR = path.join(DATA_DIR, 'contracts');
const REGISTRY_FILE = path.join(DATA_DIR, 'contracts-registry.json');
const REGISTRY_BACKUP = path.join(DATA_DIR, 'contracts-registry.json.bak');

// Storage status for admin warnings
export interface StorageStatus {
  isConfigured: boolean;
  isPersistent: boolean;
  dataDir: string;
  contractCount: number;
  warning?: string;
}

let storageWarningLogged = false;

// Ensure directories exist on module load
function ensureDirectories(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      logger.info(`[CONTRACT] Created data directory: ${DATA_DIR}`);
    }
    if (!fs.existsSync(CONTRACTS_DIR)) {
      fs.mkdirSync(CONTRACTS_DIR, { recursive: true });
      logger.info(`[CONTRACT] Created contracts directory: ${CONTRACTS_DIR}`);
    }
    
    // Production warning: if CONTRACT_DATA_DIR not set, storage may not persist
    if (IS_PRODUCTION && !process.env.CONTRACT_DATA_DIR && !storageWarningLogged) {
      logger.warn(`[CONTRACT] ⚠️ CONTRACT_DATA_DIR not set in production!`);
      logger.warn(`[CONTRACT] Contracts stored in ${DATA_DIR} may not persist after redeploy.`);
      logger.warn(`[CONTRACT] Set CONTRACT_DATA_DIR to a persistent volume (e.g., /var/data/aras).`);
      storageWarningLogged = true;
    }
  } catch (error: any) {
    logger.error(`[CONTRACT] Failed to create directories: ${error.message}`);
  }
}

/**
 * Get storage status for admin UI warnings
 */
export function getStorageStatus(): StorageStatus {
  const registry = readRegistry();
  const isPersistent = IS_PRODUCTION ? !!process.env.CONTRACT_DATA_DIR : true;
  
  return {
    isConfigured: true,
    isPersistent,
    dataDir: DATA_DIR,
    contractCount: registry.contracts.length,
    warning: !isPersistent && IS_PRODUCTION 
      ? 'Contracts storage is not persistent. Set CONTRACT_DATA_DIR to a mounted volume.'
      : undefined,
  };
}

// Initialize directories
ensureDirectories();

// ============================================================================
// REGISTRY MANAGEMENT
// ============================================================================

function readRegistry(): ContractRegistry {
  try {
    if (!fs.existsSync(REGISTRY_FILE)) {
      return { version: 1, contracts: [] };
    }
    const data = fs.readFileSync(REGISTRY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error: any) {
    logger.error(`[CONTRACT] Failed to read registry: ${error.message}`);
    
    // Try backup file if main registry is corrupted
    if (fs.existsSync(REGISTRY_BACKUP)) {
      try {
        logger.warn(`[CONTRACT] Attempting to restore from backup...`);
        const backupData = fs.readFileSync(REGISTRY_BACKUP, 'utf-8');
        const backup = JSON.parse(backupData);
        // Restore main registry from backup
        fs.writeFileSync(REGISTRY_FILE, backupData, 'utf-8');
        logger.info(`[CONTRACT] Registry restored from backup successfully`);
        return backup;
      } catch (backupError: any) {
        logger.error(`[CONTRACT] Backup restore also failed: ${backupError.message}`);
      }
    }
    
    return { version: 1, contracts: [] };
  }
}

function writeRegistry(registry: ContractRegistry): boolean {
  try {
    // Create backup of current registry before writing
    if (fs.existsSync(REGISTRY_FILE)) {
      try {
        fs.copyFileSync(REGISTRY_FILE, REGISTRY_BACKUP);
      } catch (backupErr) {
        logger.warn(`[CONTRACT] Failed to create backup: ${backupErr}`);
      }
    }
    
    // Atomic write: write to temp file, then rename
    const tempFile = `${REGISTRY_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(registry, null, 2), 'utf-8');
    fs.renameSync(tempFile, REGISTRY_FILE);
    return true;
  } catch (error: any) {
    logger.error(`[CONTRACT] Failed to write registry: ${error.message}`);
    return false;
  }
}

// ============================================================================
// CONTRACT OPERATIONS
// ============================================================================

/**
 * Create a new contract record and store the PDF file
 */
export async function createContract(params: {
  title: string;
  originalFilename: string;
  fileBuffer: Buffer;
  assignedUserId: string;
  assignedUsername?: string;
  uploadedBy: string;
  uploadedByName?: string;
}): Promise<Contract | null> {
  try {
    ensureDirectories();
    
    const id = nanoid(12);
    const storedFilename = `${id}.pdf`;
    const filePath = path.join(CONTRACTS_DIR, storedFilename);
    
    // Write PDF file
    fs.writeFileSync(filePath, params.fileBuffer);
    
    const now = new Date().toISOString();
    const contract: Contract = {
      id,
      title: params.title,
      filename: params.originalFilename,
      storedFilename,
      assignedUserId: params.assignedUserId,
      assignedUsername: params.assignedUsername,
      uploadedBy: params.uploadedBy,
      uploadedByName: params.uploadedByName,
      status: 'pending_approval',
      createdAt: now,
      updatedAt: now,
    };
    
    // Update registry
    const registry = readRegistry();
    registry.contracts.push(contract);
    
    if (!writeRegistry(registry)) {
      // Rollback: delete the file
      fs.unlinkSync(filePath);
      return null;
    }
    
    logger.info(`[CONTRACT] Created contract: ${id} - ${params.title}`);
    return contract;
  } catch (error: any) {
    logger.error(`[CONTRACT] Failed to create contract: ${error.message}`);
    return null;
  }
}

/**
 * Get contract by ID
 */
export function getContractById(id: string): Contract | null {
  const registry = readRegistry();
  return registry.contracts.find(c => c.id === id) || null;
}

/**
 * Get all contracts (admin view)
 */
export function getAllContracts(): Contract[] {
  const registry = readRegistry();
  return registry.contracts.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Get contracts assigned to a specific user
 */
export function getContractsForUser(userId: string): Contract[] {
  const registry = readRegistry();
  return registry.contracts
    .filter(c => c.assignedUserId === userId)
    .sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

/**
 * Get the file path for a contract PDF
 */
export function getContractFilePath(id: string): string | null {
  const contract = getContractById(id);
  if (!contract) return null;
  
  const filePath = path.join(CONTRACTS_DIR, contract.storedFilename);
  if (!fs.existsSync(filePath)) {
    logger.error(`[CONTRACT] File not found for contract ${id}`);
    return null;
  }
  
  return filePath;
}

/**
 * Approve a contract
 */
export function approveContract(params: {
  contractId: string;
  userId: string;
  username: string;
  typedSignature: string;
  ipAddress?: string;
  userAgent?: string;
}): { success: boolean; contract?: Contract; error?: string } {
  const registry = readRegistry();
  const contractIndex = registry.contracts.findIndex(c => c.id === params.contractId);
  
  if (contractIndex === -1) {
    return { success: false, error: 'Contract not found' };
  }
  
  const contract = registry.contracts[contractIndex];
  
  // Check assignment
  if (contract.assignedUserId !== params.userId) {
    return { success: false, error: 'Not assigned to this user' };
  }
  
  // Check if already approved (idempotent)
  if (contract.status === 'approved') {
    return { success: true, contract, error: 'Already approved' };
  }
  
  // Validate typed signature (must be uppercase and min 6 chars)
  if (!params.typedSignature || params.typedSignature.length < 6) {
    return { success: false, error: 'Signature must be at least 6 characters' };
  }
  
  if (params.typedSignature !== params.typedSignature.toUpperCase()) {
    return { success: false, error: 'Signature must be in CAPITAL LETTERS' };
  }
  
  // Update contract
  const now = new Date().toISOString();
  contract.status = 'approved';
  contract.approval = {
    userId: params.userId,
    username: params.username,
    typedSignature: params.typedSignature,
    approvedAt: now,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  };
  contract.updatedAt = now;
  
  registry.contracts[contractIndex] = contract;
  
  if (!writeRegistry(registry)) {
    return { success: false, error: 'Failed to save approval' };
  }
  
  logger.info(`[CONTRACT] Approved: ${params.contractId} by ${params.username}`);
  return { success: true, contract };
}

/**
 * Delete a contract (admin only)
 */
export function deleteContract(id: string): boolean {
  const registry = readRegistry();
  const contractIndex = registry.contracts.findIndex(c => c.id === id);
  
  if (contractIndex === -1) {
    return false;
  }
  
  const contract = registry.contracts[contractIndex];
  
  // Delete file
  try {
    const filePath = path.join(CONTRACTS_DIR, contract.storedFilename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error: any) {
    logger.error(`[CONTRACT] Failed to delete file for ${id}: ${error.message}`);
  }
  
  // Remove from registry
  registry.contracts.splice(contractIndex, 1);
  writeRegistry(registry);
  
  logger.info(`[CONTRACT] Deleted contract: ${id}`);
  return true;
}

// ============================================================================
// EXPORTS
// ============================================================================

export { CONTRACTS_DIR, DATA_DIR };
