// ============================================================================
// ARAS Command Center - Team Chat API
// ============================================================================
// REST-based team chat system for staff/admin communication
// ============================================================================

import { Router } from "express";
import { db } from "../db";
import { 
  teamChatChannels, 
  teamChatMessages, 
  teamChatChannelMembers,
  users,
  staffActivityLog
} from "@shared/schema";
import { eq, desc, and, lt, isNull, sql } from "drizzle-orm";
import { requireStaffOrAdmin } from "../middleware/staff";
import { requireAdmin } from "../middleware/admin";
import { logger } from "../logger";

const router = Router();

// ============================================================================
// CHANNELS - List all channels
// ============================================================================

router.get("/chat/channels", requireStaffOrAdmin, async (req: any, res) => {
  try {
    const channels = await db
      .select({
        id: teamChatChannels.id,
        name: teamChatChannels.name,
        description: teamChatChannels.description,
        type: teamChatChannels.type,
        createdAt: teamChatChannels.createdAt,
        updatedAt: teamChatChannels.updatedAt,
      })
      .from(teamChatChannels)
      .orderBy(teamChatChannels.name)
      .catch((dbErr: any) => {
        if (dbErr.code === '42703' || dbErr.message?.includes('does not exist')) {
          logger.warn('[CHAT] Schema mismatch - run: npx tsx scripts/run-chat-migration.ts');
          return [];
        }
        throw dbErr;
      });

    // Get message counts for each channel
    const channelsWithCounts = await Promise.all(
      channels.map(async (channel) => {
        const [countResult] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(teamChatMessages)
          .where(
            and(
              eq(teamChatMessages.channelId, channel.id),
              isNull(teamChatMessages.deletedAt)
            )
          );
        
        // Get last message
        const [lastMessage] = await db
          .select({
            content: teamChatMessages.content,
            createdAt: teamChatMessages.createdAt,
          })
          .from(teamChatMessages)
          .where(
            and(
              eq(teamChatMessages.channelId, channel.id),
              isNull(teamChatMessages.deletedAt)
            )
          )
          .orderBy(desc(teamChatMessages.createdAt))
          .limit(1);

        return {
          ...channel,
          messageCount: countResult?.count || 0,
          lastMessage: lastMessage || null,
        };
      })
    );

    logger.info("[CHAT] Fetched channels", { count: channels.length });
    res.json({ data: channelsWithCounts });
  } catch (error: any) {
    logger.error("[CHAT] Error fetching channels:", error);
    if (error.code === '42703' || error.code === '42P01' || error.message?.includes('does not exist')) {
      return res.status(503).json({ 
        error: 'Chat tables need migration. Run: npx tsx scripts/run-chat-migration.ts',
        code: 'MIGRATION_REQUIRED'
      });
    }
    res.status(500).json({ error: "Failed to fetch channels" });
  }
});

// ============================================================================
// CHANNELS - Get single channel with details
// ============================================================================

router.get("/chat/channels/:channelId", requireStaffOrAdmin, async (req: any, res) => {
  try {
    const { channelId } = req.params;

    const [channel] = await db
      .select()
      .from(teamChatChannels)
      .where(eq(teamChatChannels.id, channelId))
      .limit(1);

    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }

    // Get members
    const members = await db
      .select({
        id: teamChatChannelMembers.id,
        role: teamChatChannelMembers.role,
        joinedAt: teamChatChannelMembers.joinedAt,
        user: {
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(teamChatChannelMembers)
      .leftJoin(users, eq(teamChatChannelMembers.userId, users.id))
      .where(eq(teamChatChannelMembers.channelId, channelId));

    res.json({ 
      data: {
        ...channel,
        members,
      }
    });
  } catch (error: any) {
    logger.error("[CHAT] Error fetching channel:", error);
    res.status(500).json({ error: "Failed to fetch channel" });
  }
});

// ============================================================================
// MESSAGES - Get messages with pagination
// ============================================================================

router.get("/chat/channels/:channelId/messages", requireStaffOrAdmin, async (req: any, res) => {
  try {
    const { channelId } = req.params;
    const { before, limit = "50" } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 50, 100);

    // Build query conditions
    const conditions = [
      eq(teamChatMessages.channelId, channelId),
      isNull(teamChatMessages.deletedAt)
    ];

    if (before) {
      conditions.push(lt(teamChatMessages.id, parseInt(before as string)));
    }

    const messages = await db
      .select({
        id: teamChatMessages.id,
        content: teamChatMessages.content,
        createdAt: teamChatMessages.createdAt,
        editedAt: teamChatMessages.editedAt,
        replyToId: teamChatMessages.replyToId,
        attachments: teamChatMessages.attachments,
        userId: teamChatMessages.userId,
      })
      .from(teamChatMessages)
      .where(and(...conditions))
      .orderBy(desc(teamChatMessages.createdAt))
      .limit(limitNum);

    // Fetch user info for each message
    const messagesWithUsers = await Promise.all(
      messages.map(async (msg) => {
        const [user] = await db
          .select({
            id: users.id,
            username: users.username,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
          })
          .from(users)
          .where(eq(users.id, msg.userId))
          .limit(1);
        
        return {
          ...msg,
          user: user || null,
        };
      })
    );

    logger.info("[CHAT] Fetched messages", { channelId, count: messages.length });
    res.json({ 
      data: messagesWithUsers.reverse(), // Oldest first for display
      hasMore: messages.length === limitNum
    });
  } catch (error: any) {
    logger.error("[CHAT] Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// ============================================================================
// MESSAGES - Send new message
// ============================================================================

router.post("/chat/channels/:channelId/messages", requireStaffOrAdmin, async (req: any, res) => {
  try {
    const { channelId } = req.params;
    const { content, replyToId } = req.body;
    const userId = req.session.userId;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: "Message content is required" });
    }

    if (content.length > 5000) {
      return res.status(400).json({ error: "Message too long (max 5000 characters)" });
    }

    // Verify channel exists
    const [channel] = await db
      .select()
      .from(teamChatChannels)
      .where(eq(teamChatChannels.id, channelId))
      .limit(1);

    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }

    const [message] = await db
      .insert(teamChatMessages)
      .values({
        channelId,
        userId,
        content: content.trim(),
        replyToId: replyToId ? parseInt(replyToId) : null,
      })
      .returning();

    // Get user info for response
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Log activity
    await db.insert(staffActivityLog).values({
      userId,
      action: "message_sent",
      targetType: "channel",
      targetId: channelId,
      metadata: { messageId: message.id },
    });

    logger.info("[CHAT] Message sent", { channelId, messageId: message.id, userId });
    res.status(201).json({
      data: {
        ...message,
        user,
      },
    });
  } catch (error: any) {
    logger.error("[CHAT] Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ============================================================================
// MESSAGES - Edit message
// ============================================================================

router.patch("/chat/messages/:messageId", requireStaffOrAdmin, async (req: any, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.session.userId;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: "Message content is required" });
    }

    // Only edit own messages
    const [existing] = await db
      .select()
      .from(teamChatMessages)
      .where(eq(teamChatMessages.id, parseInt(messageId)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (existing.userId !== userId) {
      return res.status(403).json({ error: "Cannot edit this message" });
    }

    if (existing.deletedAt) {
      return res.status(400).json({ error: "Cannot edit deleted message" });
    }

    const [updated] = await db
      .update(teamChatMessages)
      .set({ 
        content: content.trim(),
        editedAt: new Date()
      })
      .where(eq(teamChatMessages.id, parseInt(messageId)))
      .returning();

    logger.info("[CHAT] Message edited", { messageId });
    res.json({ data: updated });
  } catch (error: any) {
    logger.error("[CHAT] Error editing message:", error);
    res.status(500).json({ error: "Failed to edit message" });
  }
});

// ============================================================================
// MESSAGES - Delete message (soft delete)
// ============================================================================

router.delete("/chat/messages/:messageId", requireStaffOrAdmin, async (req: any, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.session.userId;

    const [existing] = await db
      .select()
      .from(teamChatMessages)
      .where(eq(teamChatMessages.id, parseInt(messageId)))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Check if user is admin
    const [user] = await db
      .select({ userRole: users.userRole, username: users.username })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const isAdmin = user?.userRole === 'admin' || user?.username === 'ADMIN';

    // Only own messages or admin can delete
    if (existing.userId !== userId && !isAdmin) {
      return res.status(403).json({ error: "Cannot delete this message" });
    }

    await db
      .update(teamChatMessages)
      .set({ deletedAt: new Date() })
      .where(eq(teamChatMessages.id, parseInt(messageId)));

    logger.info("[CHAT] Message deleted", { messageId, deletedBy: userId });
    res.json({ success: true });
  } catch (error: any) {
    logger.error("[CHAT] Error deleting message:", error);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

// ============================================================================
// CHANNELS - Create new channel (admin only)
// ============================================================================

router.post("/chat/channels", requireAdmin, async (req: any, res) => {
  try {
    const { name, description, type = "public" } = req.body;
    const userId = req.session.userId;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: "Channel name is required" });
    }

    if (!["public", "private", "direct", "dm"].includes(type)) {
      return res.status(400).json({ error: "Invalid channel type" });
    }

    // Use raw SQL for schema compatibility
    const channelId = `channel_${Date.now()}`;
    const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    const result = await db.execute(sql`
      INSERT INTO team_chat_channels (id, name, slug, description, type, created_by, created_at, updated_at)
      VALUES (${channelId}, ${name.trim()}, ${slug}, ${description?.trim() || null}, ${type}, ${userId}, NOW(), NOW())
      RETURNING id, name, slug, description, type, created_by as "createdBy", created_at as "createdAt"
    `);
    
    const channel = (result as any)[0] || result;

    // Add creator as owner
    try {
      await db.execute(sql`
        INSERT INTO team_chat_channel_members (channel_id, user_id, role, joined_at)
        VALUES (${channelId}, ${userId}, 'owner', NOW())
        ON CONFLICT (channel_id, user_id) DO NOTHING
      `);
    } catch (e) {
      logger.warn("[CHAT] Could not add channel member:", e);
    }

    // Log activity
    try {
      await db.insert(staffActivityLog).values({
        userId,
        action: "channel_created",
        targetType: "channel",
        targetId: channel.id,
        metadata: { name, type },
      });
    } catch (e) {
      logger.warn("[CHAT] Could not log activity:", e);
    }

    logger.info("[CHAT] Channel created", { channelId: channel.id, name });
    res.status(201).json({ data: channel });
  } catch (error: any) {
    logger.error("[CHAT] Error creating channel:", error);
    if (error.code === '42703' || error.code === '42P01' || error.message?.includes('does not exist')) {
      return res.status(503).json({ 
        error: 'Run migration: npx tsx scripts/run-full-migration.ts',
        code: 'MIGRATION_REQUIRED',
        details: error.message
      });
    }
    res.status(500).json({ error: "Failed to create channel" });
  }
});

// ============================================================================
// CHANNELS - Delete channel (admin only)
// ============================================================================

router.delete("/chat/channels/:channelId", requireAdmin, async (req: any, res) => {
  try {
    const { channelId } = req.params;

    // Don't allow deleting "General" channel
    const [channel] = await db
      .select()
      .from(teamChatChannels)
      .where(eq(teamChatChannels.id, channelId))
      .limit(1);

    if (!channel) {
      return res.status(404).json({ error: "Channel not found" });
    }

    if (channel.id === "channel_general" || channel.name === "General") {
      return res.status(400).json({ error: "Cannot delete the General channel" });
    }

    // Delete members first
    await db
      .delete(teamChatChannelMembers)
      .where(eq(teamChatChannelMembers.channelId, channelId));

    // Soft delete messages
    await db
      .update(teamChatMessages)
      .set({ deletedAt: new Date() })
      .where(eq(teamChatMessages.channelId, channelId));

    // Delete channel
    await db
      .delete(teamChatChannels)
      .where(eq(teamChatChannels.id, channelId));

    logger.info("[CHAT] Channel deleted", { channelId });
    res.json({ success: true });
  } catch (error: any) {
    logger.error("[CHAT] Error deleting channel:", error);
    res.status(500).json({ error: "Failed to delete channel" });
  }
});

// ============================================================================
// SEED - Ensure General channel exists
// ============================================================================

export async function seedDefaultChannel() {
  try {
    const [existing] = await db
      .select()
      .from(teamChatChannels)
      .where(eq(teamChatChannels.name, "General"))
      .limit(1);

    if (!existing) {
      await db.insert(teamChatChannels).values({
        id: "channel_general",
        name: "General",
        description: "Allgemeiner Team-Chat",
        type: "public",
      });
      logger.info("[CHAT-SEED] Created General channel");
    }
  } catch (error: any) {
    if (error.code === '42703' || error.code === '42P01' || error.message?.includes('does not exist')) {
      logger.warn("[CHAT-SEED] Chat tables need migration. Run: npx tsx scripts/run-chat-migration.ts");
    } else {
      logger.error("[CHAT-SEED] Error seeding General channel:", error);
    }
  }
}

export default router;
