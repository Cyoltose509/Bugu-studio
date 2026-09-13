/**
 * 在单事务内把数据库恢复到备份快照。
 *
 * 保证：
 * - 失败则整笔回滚（不会出现「删了一半、插了一半」）
 * - 保留 passwordHash 等字段（加密备份里原样存）
 * - Comment 等多层自引用按拓扑顺序插入，避免外键失败
 */
import { prisma } from "@/lib/db/prisma";
import { BACKUP_DELETE_ORDER, BACKUP_TABLES, type BackupTable } from "./tables";

export type BackupBundle = {
  version: number;
  createdAt: string;
  tables: Partial<Record<BackupTable, any[]>>;
};

/** Comment.parentId 自引用：父记录必须先于子记录插入 */
export function sortSelfReferentialRecords(
  records: any[],
  parentField: string = "parentId"
): any[] {
  if (!Array.isArray(records) || records.length === 0) return [];

  const byId = new Map<string, any>();
  for (const r of records) {
    if (r?.id) byId.set(r.id, r);
  }

  const result: any[] = [];
  const visiting = new Set<string>();
  const done = new Set<string>();

  function visit(id: string) {
    if (done.has(id) || !byId.has(id)) return;
    if (visiting.has(id)) return; // 环：跳过，避免死循环
    visiting.add(id);
    const row = byId.get(id)!;
    const parentId = row[parentField];
    if (parentId) visit(parentId);
    visiting.delete(id);
    done.add(id);
    result.push(row);
  }

  for (const r of records) {
    if (r?.id) visit(r.id);
  }
  return result;
}

function prepareRecords(table: BackupTable, records: any[]): any[] {
  if (!Array.isArray(records) || records.length === 0) return [];
  if (table === "comment") return sortSelfReferentialRecords(records, "parentId");
  return records;
}

export async function restoreBundleAtomically(bundle: BackupBundle): Promise<{
  restored: string[];
  restoredCount: number;
}> {
  const restored: string[] = [];
  let restoredCount = 0;

  await prisma.$transaction(
    async (tx) => {
      // 1) 清空（倒序，避免外键卡住）
      for (const table of BACKUP_DELETE_ORDER) {
        await (tx as any)[table].deleteMany();
      }

      // 2) 写入（正序）
      for (const table of BACKUP_TABLES) {
        const raw = bundle.tables[table] ?? [];
        const records = prepareRecords(table, raw);
        if (records.length === 0) continue;

        const batchSize = 100;
        for (let i = 0; i < records.length; i += batchSize) {
          const batch = records.slice(i, i + batchSize);
          await (tx as any)[table].createMany({ data: batch });
        }

        restored.push(table);
        restoredCount += records.length;
      }
    },
    {
      maxWait: 15_000,
      // 社团库体量通常不大；超时偏长是为了避免大版本恢复中途被掐断
      timeout: 180_000,
    }
  );

  return { restored, restoredCount };
}
