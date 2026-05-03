import { Router, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db, svgDesignsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { CreateSvgDesignBody } from "@workspace/api-zod";

const router = Router();

const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const auth = getAuth(req);
  const userId = auth?.sessionClaims?.userId || auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as Request & { userId: string }).userId = userId as string;
  next();
};

function toApi(d: typeof svgDesignsTable.$inferSelect) {
  return {
    id: d.id,
    userId: d.userId,
    name: d.name,
    svgData: d.svgData,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

router.get("/svg-designs", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  try {
    const rows = await db
      .select()
      .from(svgDesignsTable)
      .where(eq(svgDesignsTable.userId, userId))
      .orderBy(desc(svgDesignsTable.updatedAt));
    res.json(rows.map(toApi));
  } catch (err) {
    req.log.error({ err }, "Failed to list svg designs");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/svg-designs", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  const parsed = CreateSvgDesignBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const trimmedName = parsed.data.name.trim();
  if (!trimmedName) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  const svg = parsed.data.svgData.trim();
  if (!/^(<\?xml[^>]*\?>\s*)?<svg[\s>]/i.test(svg)) {
    res.status(400).json({ error: "svgData must be a valid SVG document" });
    return;
  }
  if (/<script[\s>]/i.test(svg) || /\son[a-z]+\s*=/i.test(svg)) {
    res.status(400).json({ error: "svgData contains disallowed content" });
    return;
  }
  try {
    const [row] = await db
      .insert(svgDesignsTable)
      .values({
        userId,
        name: trimmedName,
        svgData: svg,
      })
      .returning();
    res.status(201).json(toApi(row));
  } catch (err) {
    req.log.error({ err }, "Failed to create svg design");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/svg-designs/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [deleted] = await db
      .delete(svgDesignsTable)
      .where(and(eq(svgDesignsTable.id, id), eq(svgDesignsTable.userId, userId)))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete svg design");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
