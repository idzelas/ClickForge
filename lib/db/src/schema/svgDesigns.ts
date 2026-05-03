import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const svgDesignsTable = pgTable("svg_designs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  svgData: text("svg_data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSvgDesignSchema = createInsertSchema(svgDesignsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSvgDesign = z.infer<typeof insertSvgDesignSchema>;
export type SvgDesign = typeof svgDesignsTable.$inferSelect;
