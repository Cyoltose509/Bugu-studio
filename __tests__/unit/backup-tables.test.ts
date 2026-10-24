import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { BACKUP_TABLES } from "@/lib/backup/tables";

describe("backup table coverage", () => {
  it("includes every Prisma model exactly once in restore dependency order", () => {
    const names = Prisma.dmmf.datamodel.models.map(
      (model) => model.name[0].toLowerCase() + model.name.slice(1)
    );
    expect([...BACKUP_TABLES].sort()).toEqual(names.sort());
    const backupTables: readonly string[] = BACKUP_TABLES;

    for (const model of Prisma.dmmf.datamodel.models) {
      const child = model.name[0].toLowerCase() + model.name.slice(1);
      for (const field of model.fields) {
        if (field.kind !== "object" || !field.relationFromFields?.length) continue;
        const parent = field.type[0].toLowerCase() + field.type.slice(1);
        if (parent === child) continue;
        expect(backupTables.indexOf(parent), `${parent} must precede ${child}`)
          .toBeLessThan(backupTables.indexOf(child));
      }
    }
  });
});
