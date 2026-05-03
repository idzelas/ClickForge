import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Per-user UI preferences. Currently just the Studio sidebar mode
 * (Simple / Advanced) so a user's choice follows them across devices.
 */
export const userPreferencesTable = pgTable("user_preferences", {
  userId: text("user_id").primaryKey(),
  sidebarMode: text("sidebar_mode").notNull().default("simple"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserPreferencesSchema = createInsertSchema(
  userPreferencesTable,
).omit({ updatedAt: true });

export type UserPreferences = typeof userPreferencesTable.$inferSelect;
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
