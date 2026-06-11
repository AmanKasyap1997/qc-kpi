// src/utils/webhookLogger.ts
import { prisma } from '../../lib/prisma';
import { Prisma } from '../../generated/prisma';
import { Logger } from './logger';

const logger = new Logger('WebhookLogger');

export interface WebhookLogEntry {
  tenantId: number;
  source: 'forth' | 'skywave';
  eventType: string;
  payload: any;
  headers?: Record<string, string | string[] | undefined>;
  processed?: boolean;
  processedAt?: Date;
  errorMessage?: string;
  dealId?: number;
}

/**
 * Safely convert payload to Prisma JsonInputValue
 */
function sanitizePayload(payload: any): Prisma.InputJsonValue {
  // If payload is already a valid JSON value, return it
  if (payload === null || typeof payload === 'string' || typeof payload === 'number' || typeof payload === 'boolean') {
    return payload;
  }
  
  // If it's an object or array, stringify and parse to ensure it's clean
  if (typeof payload === 'object') {
    try {
      // This will throw if there are circular references
      return JSON.parse(JSON.stringify(payload));
    } catch (err) {
      const error = err as Error;
      logger.error('Failed to stringify payload:', error.message);
      return { error: 'Payload serialization failed', originalType: typeof payload };
    }
  }
  
  return { value: String(payload) };
}

/**
 * Log an incoming webhook from Forth or Skywave CRM
 * 
 * @param entry - Webhook log entry data
 * @returns The created webhook log record
 */
export async function logWebhook(entry: WebhookLogEntry): Promise<any> {
  try {
    const webhookLog = await prisma.webhookLog.create({
      data: {
        tenantId: entry.tenantId,
        source: entry.source,
        eventType: entry.eventType,
        payload: sanitizePayload(entry.payload),
        // headers: sanitizeHeaders(entry.headers) || Prisma.JsonNull,
        processed: entry.processed ?? false,
        processedAt: entry.processedAt,
        errorMessage: entry.errorMessage,
        dealId: entry.dealId,
      },
    });

    logger.debug(`Webhook logged: ${entry.source} - ${entry.eventType}`, {
      id: webhookLog.id,
      source: entry.source,
      eventType: entry.eventType,
    });

    return webhookLog;
  } catch (err) {
    const error = err as Error;
    logger.error('Failed to log webhook:', error.message);
    // Don't throw - we don't want webhook processing to fail if logging fails
    return null;
  }
}

/**
 * Update an existing webhook log with processing results
 * 
 * @param id - Webhook log ID
 * @param updates - Fields to update
 */
export async function updateWebhookLog(
  id: number,
  updates: {
    processed?: boolean;
    processedAt?: Date;
    errorMessage?: string;
    dealId?: number;
  }
): Promise<void> {
  try {
    await prisma.webhookLog.update({
      where: { id },
      data: {
        processed: updates.processed,
        processedAt: updates.processedAt,
        errorMessage: updates.errorMessage,
        dealId: updates.dealId,
      },
    });

    logger.debug(`Webhook log updated: ${id}`);
  } catch (err) {
    const error = err as Error;
    logger.error('Failed to update webhook log:', error.message);
  }
}

/**
 * Get webhook log by ID
 */
export async function getWebhookLog(id: number) {
  try {
    return await prisma.webhookLog.findUnique({
      where: { id },
      include: {
        deal: {
          select: {
            id: true,
            clientName: true,
            type: true,
            atRisk: true,
            dealScore: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  } catch (err) {
    const error = err as Error;
    logger.error('Failed to get webhook log:', error.message);
    return null;
  }
}

/**
 * List webhook logs with filters
 */
export async function listWebhookLogs({
  tenantId,
  source,
  eventType,
  processed,
  startDate,
  endDate,
  limit = 100,
  offset = 0,
}: {
  tenantId?: number;
  source?: 'forth' | 'skywave';
  eventType?: string;
  processed?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  try {
    const where: Prisma.WebhookLogWhereInput = {};

    if (tenantId) where.tenantId = tenantId;
    if (source) where.source = source;
    if (eventType) where.eventType = eventType;
    if (processed !== undefined) where.processed = processed;
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [logs, total] = await Promise.all([
      prisma.webhookLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          deal: {
            select: {
              id: true,
              clientName: true,
              type: true,
              atRisk: true,
            },
          },
        },
      }),
      prisma.webhookLog.count({ where }),
    ]);

    return { logs, total };
  } catch (err) {
    const error = err as Error;
    logger.error('Failed to list webhook logs:', error.message);
    return { logs: [], total: 0 };
  }
}

/**
 * Get webhook log statistics
 */
export async function getWebhookStats(tenantId: number) {
  try {
    const [total, processed, failed, bySource, byEventType, last24h] = await Promise.all([
      prisma.webhookLog.count({ where: { tenantId } }),
      prisma.webhookLog.count({ where: { tenantId, processed: true } }),
      prisma.webhookLog.count({ 
        where: { 
          tenantId, 
          processed: true,
          errorMessage: { not: null }
        } 
      }),
      prisma.webhookLog.groupBy({
        by: ['source'],
        where: { tenantId },
        _count: true,
      }),
      prisma.webhookLog.groupBy({
        by: ['eventType'],
        where: { tenantId },
        _count: true,
        orderBy: { _count: { eventType: 'desc' } },
        take: 10,
      }),
      prisma.webhookLog.count({
        where: {
          tenantId,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    return {
      total,
      processed,
      failed,
      successRate: total > 0 ? ((processed - failed) / total * 100).toFixed(2) : '0',
      last24h,
      bySource: bySource.map(s => ({ source: s.source, count: s._count })),
      topEventTypes: byEventType.map(e => ({ eventType: e.eventType, count: e._count })),
    };
  } catch (err) {
    const error = err as Error;
    logger.error('Failed to get webhook stats:', error.message);
    return null;
  }
}

/**
 * Delete old webhook logs (e.g., retention policy)
 */
export async function deleteOldWebhookLogs(daysOld: number = 90): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await prisma.webhookLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    logger.info(`Deleted ${result.count} webhook logs older than ${daysOld} days`);
    return result.count;
  } catch (err) {
    const error = err as Error;
    logger.error('Failed to delete old webhook logs:', error.message);
    return 0;
  }
}

/**
 * Retry failed webhook processing (manual or scheduled)
 */
export async function retryFailedWebhooks(tenantId: number, limit: number = 10): Promise<string[]> {
  try {
    const failedLogs = await prisma.webhookLog.findMany({
      where: {
        tenantId,
        processed: true,
        errorMessage: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const retriedIds: string[] = [];

    for (const log of failedLogs) {
      // Here you would re-process the webhook
      // This is a placeholder - implement based on your retry logic
      await prisma.webhookLog.update({
        where: { id: log.id },
        data: {
          processed: false,
          errorMessage: null,
        },
      });
      retriedIds.push(String(log.id));
    }

    logger.info(`Reset ${retriedIds.length} failed webhooks for retry`);
    return retriedIds;
  } catch (err) {
    const error = err as Error;
    logger.error('Failed to retry webhooks:', error.message);
    return [];
  }
}