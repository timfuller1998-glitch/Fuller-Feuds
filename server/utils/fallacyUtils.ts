import { db } from '../db.js';
import { opinionFlags, topicFlags, debateMessageFlags } from '@shared/schema';
import { count, inArray, sql, SQL } from 'drizzle-orm';
import { FALLACY_OPTIONS } from '@shared/fallacies';

/**
 * Aggregates fallacy counts for a list of entities (opinions, topics, or debate messages)
 * Returns a map of entity ID -> fallacy type -> count
 */
export async function aggregateFallacyCounts<T extends { id: string }>(
  entities: T[],
  flagTable: typeof opinionFlags | typeof topicFlags | typeof debateMessageFlags,
  entityIdField: string
): Promise<Map<string, Record<string, number>>> {
  if (entities.length === 0) {
    return new Map();
  }

  const entityIds = entities.map(e => e.id);

  // Type-safe column access using sql template
  const column = (flagTable as any)[entityIdField];

  // Query all flags for these entities
  const flags = await db
    .select({
      entityId: column,
      fallacyType: flagTable.fallacyType,
      count: count()
    })
    .from(flagTable)
    .where(inArray(column, entityIds))
    .groupBy(column, flagTable.fallacyType);

  // Build map of entity ID -> fallacy counts
  const countsMap = new Map<string, Record<string, number>>();

  for (const entity of entities) {
    // Initialize with all fallacy types at 0
    const fallacyCounts: Record<string, number> = {};
    FALLACY_OPTIONS.forEach(f => {
      fallacyCounts[f.id] = 0;
    });
    countsMap.set(entity.id, fallacyCounts);
  }

  // Fill in actual counts
  for (const flag of flags) {
    const counts = countsMap.get(flag.entityId as string);
    if (counts && flag.fallacyType) {
      counts[flag.fallacyType] = Number(flag.count);
    }
  }

  return countsMap;
}

