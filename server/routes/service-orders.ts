/**
 * SERVICE ORDERS API - Done-for-You Onboarding Flow
 * 
 * Routes:
 * - POST /api/service-orders (Client: Create draft order)
 * - GET /api/admin/service-orders (Admin: List orders with filters)
 * - GET /api/admin/service-orders/:id (Admin: Order detail with events)
 * - POST /api/admin/service-orders/:id/assign (Admin: Assign staff)
 * - POST /api/admin/service-orders/:id/status (Admin: Change status)
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { serviceOrders, serviceOrderEvents, users } from '@shared/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { requireStaffOrAdmin } from '../middleware/staff';
import Stripe from 'stripe';

// Initialize Stripe
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' as any })
  : null;

const router = Router();

// ============================================================================
// SERVER-AUTHORITATIVE PRICING (Tamper-proof)
// ============================================================================
interface CallPackageDef {
  volume: number;
  pricePerCallCents: number;
}

const CALL_PACKAGES: Record<string, CallPackageDef> = {
  'calls_2500':   { volume: 2500,   pricePerCallCents: 39 },
  'calls_5000':   { volume: 5000,   pricePerCallCents: 35 },
  'calls_10000':  { volume: 10000,  pricePerCallCents: 32 },
  'calls_20000':  { volume: 20000,  pricePerCallCents: 28 },
  'calls_50000':  { volume: 50000,  pricePerCallCents: 24 },
  'calls_100000': { volume: 100000, pricePerCallCents: 20 },
};

const LEAD_PRICE_CENTS = 5; // €0.05 per lead

function computeServerPrice(
  packageCode: string,
  targetCalls: number,
  leadsMode?: 'have' | 'need',
  leadPackageSize?: number
): { valid: boolean; error?: string; callsTotalCents: number; leadsTotalCents: number; grandTotalCents: number } {
  const pkg = CALL_PACKAGES[packageCode];
  
  if (!pkg) {
    return { valid: false, error: `Unknown package: ${packageCode}`, callsTotalCents: 0, leadsTotalCents: 0, grandTotalCents: 0 };
  }
  
  if (pkg.volume !== targetCalls) {
    return { valid: false, error: `Target calls ${targetCalls} does not match package ${packageCode} (expected ${pkg.volume})`, callsTotalCents: 0, leadsTotalCents: 0, grandTotalCents: 0 };
  }
  
  const callsTotalCents = targetCalls * pkg.pricePerCallCents;
  let leadsTotalCents = 0;
  
  if (leadsMode === 'need') {
    if (!leadPackageSize || leadPackageSize <= 0) {
      return { valid: false, error: 'Lead package size required when leadsMode is "need"', callsTotalCents: 0, leadsTotalCents: 0, grandTotalCents: 0 };
    }
    leadsTotalCents = leadPackageSize * LEAD_PRICE_CENTS;
  }
  
  const grandTotalCents = callsTotalCents + leadsTotalCents;
  
  return { valid: true, callsTotalCents, leadsTotalCents, grandTotalCents };
}

function sanitizeMetadata(metadata: any): Record<string, any> {
  if (!metadata || typeof metadata !== 'object') return {};
  
  const sanitized: Record<string, any> = {};
  const allowedKeys = [
    'customerType', 'useCaseId', 'voiceId', 'leadsMode', 'leadPackageSize', 
    'leadFilters', 'goalPrimary', 'goalMetric', 'goalBrief', 'goalGuardrails', 
    'tone', 'callsTotalCents', 'leadsTotalCents', 'grandTotalCents'
  ];
  
  for (const key of allowedKeys) {
    if (metadata[key] !== undefined) {
      // Truncate goalBrief to 500 chars
      if (key === 'goalBrief' && typeof metadata[key] === 'string') {
        sanitized[key] = metadata[key].slice(0, 500);
      } else {
        sanitized[key] = metadata[key];
      }
    }
  }
  
  return sanitized;
}

// ============================================================================
// HELPER: Create Event
// ============================================================================
async function createOrderEvent(
  orderId: number,
  type: string,
  title: string,
  actorId?: string,
  description?: string,
  metadata?: Record<string, any>
) {
  const [event] = await db.insert(serviceOrderEvents).values({
    orderId,
    type,
    title,
    description,
    actorId,
    metadata,
  }).returning();
  return event;
}

// ============================================================================
// HELPER: Require Auth (basic session check)
// ============================================================================
function requireAuth(req: Request, res: Response, next: any) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ============================================================================
// CLIENT ROUTES
// ============================================================================

/**
 * POST /api/service-orders
 * Create a new service order (draft status)
 * Requires: authenticated user
 * 
 * SECURITY: Server computes price authoritatively. Client priceCents is IGNORED.
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session!.userId as string;
    const {
      companyName,
      contactName,
      contactEmail,
      contactPhone,
      packageCode,
      targetCalls,
      currency = 'eur',
      metadata,
      // Leads fields
      leadsMode,
      leadPackageSize,
      leadFilters,
    } = req.body;

    // Validate required fields
    if (!packageCode || !targetCalls) {
      return res.status(400).json({ 
        error: 'Missing required fields: packageCode, targetCalls',
        code: 'MISSING_FIELDS'
      });
    }

    // SERVER-AUTHORITATIVE PRICING: Compute price server-side
    const pricing = computeServerPrice(packageCode, targetCalls, leadsMode, leadPackageSize);
    
    if (!pricing.valid) {
      console.warn(`[SERVICE-ORDERS] Pricing validation failed: ${pricing.error}`);
      return res.status(400).json({ 
        error: pricing.error,
        code: 'INVALID_PRICING'
      });
    }

    // Sanitize and enrich metadata
    const sanitizedMetadata = sanitizeMetadata({
      ...metadata,
      leadsMode,
      leadPackageSize,
      leadFilters,
      callsTotalCents: pricing.callsTotalCents,
      leadsTotalCents: pricing.leadsTotalCents,
      grandTotalCents: pricing.grandTotalCents,
    });

    // Create order with server-computed price
    const [order] = await db.insert(serviceOrders).values({
      clientUserId: userId,
      companyName,
      contactName,
      contactEmail,
      contactPhone,
      packageCode,
      targetCalls,
      priceCents: pricing.grandTotalCents, // SERVER-AUTHORITATIVE
      currency,
      status: 'draft',
      paymentStatus: 'unpaid',
      metadata: sanitizedMetadata,
    }).returning();

    // Create initial event
    await createOrderEvent(
      order.id,
      'created',
      'Order erstellt',
      userId,
      `Neuer Service-Auftrag für ${packageCode} erstellt`,
      { 
        packageCode, 
        targetCalls, 
        callsTotalCents: pricing.callsTotalCents,
        leadsTotalCents: pricing.leadsTotalCents,
        grandTotalCents: pricing.grandTotalCents,
      }
    );

    console.log(`[SERVICE-ORDERS] Created order ${order.id} for user ${userId}, total: ${pricing.grandTotalCents} cents`);
    res.status(201).json(order);
  } catch (error: any) {
    console.error('[SERVICE-ORDERS] Error creating order:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/service-orders
 * List orders for the current user
 * Requires: authenticated user
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session!.userId as string;

    const orders = await db
      .select()
      .from(serviceOrders)
      .where(eq(serviceOrders.clientUserId, userId))
      .orderBy(desc(serviceOrders.createdAt));

    res.json(orders);
  } catch (error: any) {
    console.error('[SERVICE-ORDERS] Error listing user orders:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/service-orders/:id
 * Get order detail with events for the current user
 * Requires: authenticated user, order must belong to user
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session!.userId as string;
    const orderId = parseInt(req.params.id, 10);

    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    // Get order and verify ownership
    const [order] = await db
      .select({
        id: serviceOrders.id,
        status: serviceOrders.status,
        paymentStatus: serviceOrders.paymentStatus,
        packageCode: serviceOrders.packageCode,
        targetCalls: serviceOrders.targetCalls,
        priceCents: serviceOrders.priceCents,
        currency: serviceOrders.currency,
        companyName: serviceOrders.companyName,
        contactName: serviceOrders.contactName,
        contactEmail: serviceOrders.contactEmail,
        createdAt: serviceOrders.createdAt,
        updatedAt: serviceOrders.updatedAt,
        metadata: serviceOrders.metadata,
        clientUserId: serviceOrders.clientUserId,
      })
      .from(serviceOrders)
      .where(eq(serviceOrders.id, orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Ownership check
    if (order.clientUserId !== userId) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Get events for this order
    const events = await db
      .select({
        id: serviceOrderEvents.id,
        type: serviceOrderEvents.type,
        title: serviceOrderEvents.title,
        description: serviceOrderEvents.description,
        createdAt: serviceOrderEvents.createdAt,
      })
      .from(serviceOrderEvents)
      .where(eq(serviceOrderEvents.orderId, orderId))
      .orderBy(serviceOrderEvents.createdAt);

    // Remove clientUserId from response (internal field)
    const { clientUserId, ...safeOrder } = order;

    console.log(`[SERVICE-ORDERS] User ${userId} fetched order ${orderId} with ${events.length} events`);
    res.json({ order: safeOrder, events });
  } catch (error: any) {
    console.error('[SERVICE-ORDERS] Error fetching user order:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/service-orders/:id/checkout
 * Create Stripe Checkout Session for one-time payment
 * Requires: authenticated user, order must belong to user
 * 
 * IDEMPOTENT: Returns existing session URL if pending, creates new only if needed.
 */
router.post('/:id/checkout', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session!.userId as string;
    const orderId = parseInt(req.params.id, 10);

    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    if (!stripe) {
      console.error('[SERVICE-ORDERS] Stripe not configured');
      return res.status(500).json({ error: 'Payment system unavailable' });
    }

    // Get order and verify ownership
    const [order] = await db
      .select()
      .from(serviceOrders)
      .where(eq(serviceOrders.id, orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.clientUserId !== userId) {
      return res.status(403).json({ error: 'Not authorized to access this order' });
    }

    // Already paid → 409 Conflict
    if (order.paymentStatus === 'paid') {
      return res.status(409).json({ 
        error: 'Order already paid',
        code: 'ALREADY_PAID'
      });
    }

    // IDEMPOTENCY: Check for existing pending session
    if (order.paymentStatus === 'pending' && order.paymentReference) {
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(order.paymentReference);
        
        // Session still open → return existing URL
        if (existingSession.status !== 'complete' && existingSession.url) {
          console.log(`[SERVICE-ORDERS] Returning existing session for order ${orderId}`);
          return res.json({ url: existingSession.url });
        }
        
        // Session expired or complete but not marked paid → reset for new session
        console.log(`[SERVICE-ORDERS] Existing session ${order.paymentReference} expired/complete, creating new`);
        await db
          .update(serviceOrders)
          .set({
            paymentStatus: 'unpaid',
            paymentReference: null,
            updatedAt: new Date(),
          })
          .where(eq(serviceOrders.id, orderId));
      } catch (stripeErr: any) {
        // Session not found or error → reset and create new
        console.warn(`[SERVICE-ORDERS] Could not retrieve session ${order.paymentReference}: ${stripeErr.message}`);
        await db
          .update(serviceOrders)
          .set({
            paymentStatus: 'unpaid',
            paymentReference: null,
            updatedAt: new Date(),
          })
          .where(eq(serviceOrders.id, orderId));
      }
    }

    // Get user for customer info
    const [user] = await db
      .select({ email: users.email, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const customerEmail = order.contactEmail || user?.email || undefined;
    const appUrl = process.env.APP_URL || 'http://localhost:5000';

    // Create NEW Stripe Checkout Session (one-time payment)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: customerEmail,
      line_items: [
        {
          price_data: {
            currency: order.currency || 'eur',
            unit_amount: order.priceCents, // SERVER-AUTHORITATIVE price
            product_data: {
              name: 'ARAS Campaign Setup',
              description: `${order.targetCalls?.toLocaleString()} calls - ${order.packageCode}`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/campaign-studio?success=true&order_id=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/campaign-studio?canceled=true&order_id=${orderId}`,
      metadata: {
        userId,
        orderId: orderId.toString(),
        type: 'service_order',
      },
    });

    // Update order to pending with session reference
    await db
      .update(serviceOrders)
      .set({
        paymentStatus: 'pending',
        paymentReference: session.id,
        updatedAt: new Date(),
      })
      .where(eq(serviceOrders.id, orderId));

    // Create event
    await createOrderEvent(
      orderId,
      'checkout_started',
      'Checkout gestartet',
      userId,
      `Stripe Checkout Session erstellt`,
      { sessionId: session.id }
    );

    console.log(`[SERVICE-ORDERS] Checkout session created for order ${orderId}`);
    res.json({ url: session.url });
  } catch (error: any) {
    console.error('[SERVICE-ORDERS] Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to start checkout' });
  }
});

// ============================================================================
// ADMIN ROUTES
// ============================================================================

/**
 * GET /api/admin/service-orders
 * List all orders with optional filters
 * Requires: staff or admin role
 */
router.get('/admin', requireStaffOrAdmin, async (req: Request, res: Response) => {
  try {
    const { status, paymentStatus, limit = '50', offset = '0' } = req.query;

    let query = db.select().from(serviceOrders);

    // Build where conditions
    const conditions = [];
    if (status && typeof status === 'string') {
      conditions.push(eq(serviceOrders.status, status));
    }
    if (paymentStatus && typeof paymentStatus === 'string') {
      conditions.push(eq(serviceOrders.paymentStatus, paymentStatus));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const orders = await query
      .orderBy(desc(serviceOrders.createdAt))
      .limit(parseInt(limit as string, 10))
      .offset(parseInt(offset as string, 10));

    // Get total count for pagination
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(serviceOrders)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    console.log(`[SERVICE-ORDERS] Admin fetched ${orders.length} orders`);
    res.json({
      orders,
      total: countResult?.count || 0,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
  } catch (error: any) {
    console.error('[SERVICE-ORDERS] Error listing admin orders:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/service-orders/:id
 * Get order detail including events timeline
 * Requires: staff or admin role
 */
router.get('/admin/:id', requireStaffOrAdmin, async (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    // Get order
    const [order] = await db
      .select()
      .from(serviceOrders)
      .where(eq(serviceOrders.id, orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Get events
    const events = await db
      .select()
      .from(serviceOrderEvents)
      .where(eq(serviceOrderEvents.orderId, orderId))
      .orderBy(desc(serviceOrderEvents.createdAt));

    // Get client user info
    let clientUser = null;
    if (order.clientUserId) {
      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          company: users.company,
        })
        .from(users)
        .where(eq(users.id, order.clientUserId))
        .limit(1);
      clientUser = user || null;
    }

    // Get assigned staff info
    let assignedStaff = null;
    if (order.assignedStaffId) {
      const [staff] = await db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(eq(users.id, order.assignedStaffId))
        .limit(1);
      assignedStaff = staff || null;
    }

    console.log(`[SERVICE-ORDERS] Admin fetched order ${orderId} with ${events.length} events`);
    res.json({
      order,
      events,
      clientUser,
      assignedStaff,
    });
  } catch (error: any) {
    console.error('[SERVICE-ORDERS] Error fetching order detail:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/service-orders/:id/assign
 * Assign staff to order
 * Requires: staff or admin role
 */
router.post('/admin/:id/assign', requireStaffOrAdmin, async (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const actorId = req.session!.userId as string;
    const { staffId } = req.body;

    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    // Get current order
    const [currentOrder] = await db
      .select()
      .from(serviceOrders)
      .where(eq(serviceOrders.id, orderId))
      .limit(1);

    if (!currentOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const previousStaffId = currentOrder.assignedStaffId;

    // Update order
    const [updatedOrder] = await db
      .update(serviceOrders)
      .set({
        assignedStaffId: staffId || null,
        updatedAt: new Date(),
      })
      .where(eq(serviceOrders.id, orderId))
      .returning();

    // Get staff name for event
    let staffName = 'Unassigned';
    if (staffId) {
      const [staff] = await db
        .select({ firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, staffId))
        .limit(1);
      if (staff) {
        staffName = [staff.firstName, staff.lastName].filter(Boolean).join(' ') || staffId;
      }
    }

    // Create event
    await createOrderEvent(
      orderId,
      'assigned',
      staffId ? `Zugewiesen an ${staffName}` : 'Zuweisung entfernt',
      actorId,
      undefined,
      { previousStaffId, newStaffId: staffId }
    );

    console.log(`[SERVICE-ORDERS] Order ${orderId} assigned to ${staffId || 'nobody'} by ${actorId}`);
    res.json(updatedOrder);
  } catch (error: any) {
    console.error('[SERVICE-ORDERS] Error assigning staff:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/service-orders/:id/status
 * Change order status
 * Requires: staff or admin role
 */
router.post('/admin/:id/status', requireStaffOrAdmin, async (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const actorId = req.session!.userId as string;
    const { status, note } = req.body;

    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    // Validate status
    const validStatuses = ['draft', 'paid', 'intake', 'in_progress', 'paused', 'completed', 'canceled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    // Get current order
    const [currentOrder] = await db
      .select()
      .from(serviceOrders)
      .where(eq(serviceOrders.id, orderId))
      .limit(1);

    if (!currentOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const previousStatus = currentOrder.status;

    // Update order
    const [updatedOrder] = await db
      .update(serviceOrders)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(serviceOrders.id, orderId))
      .returning();

    // Map status to event type
    const statusEventMap: Record<string, string> = {
      paid: 'paid',
      intake: 'started',
      in_progress: 'started',
      paused: 'paused',
      completed: 'completed',
      canceled: 'completed',
      draft: 'note',
    };

    // Create event
    await createOrderEvent(
      orderId,
      statusEventMap[status] || 'note',
      `Status geändert: ${previousStatus} → ${status}`,
      actorId,
      note || undefined,
      { previousStatus, newStatus: status }
    );

    // TODO: Log to activity service if available
    // if (activityService) {
    //   await activityService.log({
    //     actionKey: 'SERVICE_ORDER_STATUS_CHANGE',
    //     orderId,
    //     previousStatus,
    //     newStatus: status,
    //     actorId,
    //   });
    // }

    console.log(`[SERVICE-ORDERS] Order ${orderId} status changed: ${previousStatus} → ${status} by ${actorId}`);
    res.json(updatedOrder);
  } catch (error: any) {
    console.error('[SERVICE-ORDERS] Error changing status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/service-orders/:id/payment
 * Update payment status (e.g., after Stripe webhook)
 * Requires: staff or admin role
 */
router.post('/admin/:id/payment', requireStaffOrAdmin, async (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const actorId = req.session!.userId as string;
    const { paymentStatus, paymentReference, note } = req.body;

    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    // Validate payment status
    const validPaymentStatuses = ['unpaid', 'paid', 'failed', 'refunded'];
    if (!paymentStatus || !validPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({ 
        error: `Invalid paymentStatus. Must be one of: ${validPaymentStatuses.join(', ')}` 
      });
    }

    // Get current order
    const [currentOrder] = await db
      .select()
      .from(serviceOrders)
      .where(eq(serviceOrders.id, orderId))
      .limit(1);

    if (!currentOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const previousPaymentStatus = currentOrder.paymentStatus;

    // Update order
    const updateData: any = {
      paymentStatus,
      updatedAt: new Date(),
    };
    if (paymentReference !== undefined) {
      updateData.paymentReference = paymentReference;
    }

    const [updatedOrder] = await db
      .update(serviceOrders)
      .set(updateData)
      .where(eq(serviceOrders.id, orderId))
      .returning();

    // Create event
    await createOrderEvent(
      orderId,
      paymentStatus === 'paid' ? 'paid' : 'note',
      `Zahlungsstatus: ${previousPaymentStatus} → ${paymentStatus}`,
      actorId,
      note || undefined,
      { previousPaymentStatus, newPaymentStatus: paymentStatus, paymentReference }
    );

    console.log(`[SERVICE-ORDERS] Order ${orderId} payment status: ${previousPaymentStatus} → ${paymentStatus}`);
    res.json(updatedOrder);
  } catch (error: any) {
    console.error('[SERVICE-ORDERS] Error updating payment:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/service-orders/:id/note
 * Add a note to the order timeline
 * Requires: staff or admin role
 */
router.post('/admin/:id/note', requireStaffOrAdmin, async (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const actorId = req.session!.userId as string;
    const { title, description } = req.body;

    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Verify order exists
    const [order] = await db
      .select({ id: serviceOrders.id })
      .from(serviceOrders)
      .where(eq(serviceOrders.id, orderId))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Create note event
    const event = await createOrderEvent(
      orderId,
      'note',
      title,
      actorId,
      description
    );

    console.log(`[SERVICE-ORDERS] Note added to order ${orderId} by ${actorId}`);
    res.status(201).json(event);
  } catch (error: any) {
    console.error('[SERVICE-ORDERS] Error adding note:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
