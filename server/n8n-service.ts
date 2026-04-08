import { logger } from "./logger";

const N8N_BASE_URL = process.env.N8N_BASE_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

// ============================================================================
// N8N API TYPES
// ============================================================================

export interface N8NWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  nodes: any[];
  connections: any;
  settings: any;
  tags?: string[];
}

export interface N8NExecution {
  id: string;
  finished: boolean;
  mode: string;
  startedAt: string;
  stoppedAt: string | null;
  workflowId: string;
  status: "success" | "error" | "waiting" | "running";
  data?: any;
  retryOf?: string;
  retrySuccessId?: string;
  workflowData?: {
    id: string;
    name: string;
  };
}

export interface N8NWorkflowsResponse {
  data: N8NWorkflow[];
  nextCursor?: string;
}

export interface N8NExecutionsResponse {
  data: N8NExecution[];
  nextCursor?: string;
}

export interface N8NExecutionResponse {
  data: N8NExecution;
}

export interface N8NRunWorkflowResponse {
  executionId: string;
}

// ============================================================================
// N8N SERVICE
// ============================================================================

class N8NService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    if (!N8N_BASE_URL) {
      throw new Error('N8N_BASE_URL environment variable is not set');
    }
    if (!N8N_API_KEY) {
      throw new Error('N8N_API_KEY environment variable is not set');
    }

    this.baseUrl = N8N_BASE_URL;
    this.apiKey = N8N_API_KEY;

    logger.info('[N8N-SERVICE] Initialized', {
      baseUrl: this.baseUrl,
      hasApiKey: !!this.apiKey
    });
  }

  /**
   * Generic request method for N8N API
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/api/v1${endpoint}`;
    
    logger.info('[N8N-SERVICE] Request', {
      method: options.method || 'GET',
      endpoint,
      url
    });

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          "X-N8N-API-KEY": this.apiKey,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('[N8N-SERVICE] Request failed', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          endpoint
        });
        throw new Error(`N8N API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      logger.info('[N8N-SERVICE] Request successful', {
        endpoint,
        dataKeys: data ? Object.keys(data) : []
      });

      return data;
    } catch (error: any) {
      logger.error('[N8N-SERVICE] Request exception', {
        endpoint,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get all workflows
   */
  async getWorkflows(): Promise<N8NWorkflowsResponse> {
    return this.request<N8NWorkflowsResponse>("/workflows");
  }

  /**
   * Get a single workflow by ID
   */
  async getWorkflow(id: string): Promise<N8NWorkflow> {
    return this.request<N8NWorkflow>(`/workflows/${id}`);
  }

  /**
   * Activate a workflow
   */
  async activateWorkflow(id: string): Promise<N8NWorkflow> {
    logger.info('[N8N-SERVICE] Activating workflow', { id });
    return this.request<N8NWorkflow>(`/workflows/${id}/activate`, {
      method: "POST"
    });
  }

  /**
   * Deactivate a workflow
   */
  async deactivateWorkflow(id: string): Promise<N8NWorkflow> {
    logger.info('[N8N-SERVICE] Deactivating workflow', { id });
    return this.request<N8NWorkflow>(`/workflows/${id}/deactivate`, {
      method: "POST"
    });
  }

  /**
   * Get executions (with optional filtering and pagination)
   */
  async getExecutions(workflowId?: string, limit = 20): Promise<N8NExecutionsResponse> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (workflowId) {
      params.append("workflowId", workflowId);
    }
    
    return this.request<N8NExecutionsResponse>(`/executions?${params}`);
  }

  /**
   * Get a single execution by ID
   */
  async getExecution(id: string): Promise<N8NExecution> {
    const response = await this.request<N8NExecutionResponse>(`/executions/${id}`);
    return response.data;
  }

  /**
   * Manually run a workflow (for workflows with Manual Trigger)
   */
  async runWorkflow(id: string, data?: any): Promise<N8NRunWorkflowResponse> {
    logger.info('[N8N-SERVICE] Running workflow manually', { id, hasData: !!data });
    
    return this.request<N8NRunWorkflowResponse>(`/workflows/${id}/run`, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined
    });
  }

  /**
   * Get workflow statistics
   */
  async getWorkflowStats(id: string): Promise<{
    total: number;
    success: number;
    error: number;
    waiting: number;
    running: number;
  }> {
    const executions = await this.getExecutions(id, 100);
    
    const stats = {
      total: executions.data.length,
      success: 0,
      error: 0,
      waiting: 0,
      running: 0
    };

    executions.data.forEach(exec => {
      if (exec.status in stats) {
        stats[exec.status]++;
      }
    });

    return stats;
  }

  /**
   * Health check - verify API connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.getWorkflows();
      logger.info('[N8N-SERVICE] Health check passed');
      return true;
    } catch (error: any) {
      logger.error('[N8N-SERVICE] Health check failed', { error: error.message });
      return false;
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const n8nService = new N8NService();
