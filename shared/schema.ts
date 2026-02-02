import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, date, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  userId: varchar("user_id"),
  isDefault: boolean("is_default").default(false),
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
});
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

export const billingCycleEnum = ["monthly", "yearly", "custom"] as const;
export const statusEnum = ["active", "trial", "cancelled"] as const;
export const reminderDaysEnum = [1, 3, 7] as const;

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  serviceName: text("service_name").notNull(),
  categoryId: varchar("category_id"),
  cost: numeric("cost", { precision: 10, scale: 2 }).notNull(),
  billingCycle: text("billing_cycle").notNull().$type<"monthly" | "yearly" | "custom">(),
  customMonths: integer("custom_months"),
  nextBillingDate: date("next_billing_date").notNull(),
  status: text("status").notNull().$type<"active" | "trial" | "cancelled">(),
  trialEndDate: date("trial_end_date"),
  paymentMethod: text("payment_method"),
  notes: text("notes"),
  reminderDays: integer("reminder_days"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
}).extend({
  cost: z.string().or(z.number()).transform(v => String(v)),
  nextBillingDate: z.string(),
  trialEndDate: z.string().nullable().optional(),
});
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

export const userPreferences = pgTable("user_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  currency: text("currency").default("USD"),
  timezone: text("timezone").default("America/New_York"),
  displayName: text("display_name"),
});

export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({
  id: true,
});
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;
