import { Router, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db, userPreferencesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const SIDEBAR_MODES = ["simple", "advanced"] as const;
type SidebarMode = (typeof SIDEBAR_MODES)[number];
const isSidebarMode = (v: unknown): v is SidebarMode =>
  typeof v === "string" && (SIDEBAR_MODES as readonly string[]).includes(v);

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

const DEFAULT = { sidebarMode: "simple" as const };

router.get("/user/preferences", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  const rows = await db
    .select()
    .from(userPreferencesTable)
    .where(eq(userPreferencesTable.userId, userId))
    .limit(1);
  if (!rows.length) {
    res.json(DEFAULT);
    return;
  }
  const r = rows[0]!;
  res.json({
    sidebarMode: r.sidebarMode === "advanced" ? "advanced" : "simple",
  });
});

router.put("/user/preferences", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as Request & { userId: string }).userId;
  const body = req.body as { sidebarMode?: unknown } | undefined;
  const sidebarMode = body?.sidebarMode;
  if (!isSidebarMode(sidebarMode)) {
    res.status(400).json({ error: "Invalid sidebarMode" });
    return;
  }
  await db
    .insert(userPreferencesTable)
    .values({ userId, sidebarMode })
    .onConflictDoUpdate({
      target: userPreferencesTable.userId,
      set: { sidebarMode, updatedAt: new Date() },
    });
  res.json({ sidebarMode });
});

export default router;
