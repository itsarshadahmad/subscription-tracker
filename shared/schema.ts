import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, date, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
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
export const sharingTypeEnum = ["personal", "shared"] as const;

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  serviceName: text("service_name").notNull(),
  categoryId: varchar("category_id"),
  cost: numeric("cost", { precision: 10, scale: 2 }).notNull(),
  originalCurrency: text("original_currency").default("USD"),
  billingCycle: text("billing_cycle").notNull().$type<"monthly" | "yearly" | "custom">(),
  customMonths: integer("custom_months"),
  nextBillingDate: date("next_billing_date").notNull(),
  status: text("status").notNull().$type<"active" | "trial" | "cancelled">(),
  trialEndDate: date("trial_end_date"),
  paymentMethod: text("payment_method"),
  notes: text("notes"),
  reminderDays: integer("reminder_days"),
  sharingType: text("sharing_type").default("personal").$type<"personal" | "shared">(),
  lastViewedAt: timestamp("last_viewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  lastViewedAt: true,
}).extend({
  cost: z.string().or(z.number()).transform(v => String(v)),
  nextBillingDate: z.string(),
  trialEndDate: z.string().nullable().optional(),
  originalCurrency: z.string().optional(),
  sharingType: z.enum(["personal", "shared"]).optional(),
});
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

export const userPreferences = pgTable("user_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  currency: text("currency").default("USD"),
  timezone: text("timezone").default("America/New_York"),
  displayName: text("display_name"),
  monthlySpendingLimit: numeric("monthly_spending_limit", { precision: 10, scale: 2 }),
});

export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({
  id: true,
});
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;

export const costHistory = pgTable("cost_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: varchar("subscription_id").notNull(),
  userId: varchar("user_id").notNull(),
  oldCost: numeric("old_cost", { precision: 10, scale: 2 }).notNull(),
  newCost: numeric("new_cost", { precision: 10, scale: 2 }).notNull(),
  changedAt: timestamp("changed_at").defaultNow(),
});

export const insertCostHistorySchema = createInsertSchema(costHistory).omit({
  id: true,
  changedAt: true,
});
export type InsertCostHistory = z.infer<typeof insertCostHistorySchema>;
export type CostHistory = typeof costHistory.$inferSelect;

export const monthlySnapshots = pgTable("monthly_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  totalMonthly: numeric("total_monthly", { precision: 10, scale: 2 }).notNull(),
  totalYearly: numeric("total_yearly", { precision: 10, scale: 2 }).notNull(),
  subscriptionCount: integer("subscription_count").notNull(),
  categoryBreakdown: jsonb("category_breakdown"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMonthlySnapshotSchema = createInsertSchema(monthlySnapshots).omit({
  id: true,
  createdAt: true,
});
export type InsertMonthlySnapshot = z.infer<typeof insertMonthlySnapshotSchema>;
export type MonthlySnapshot = typeof monthlySnapshots.$inferSelect;

export const alertTypeEnum = ["price_increase", "unused_subscription", "high_spending", "trial_ending", "renewal_reminder"] as const;

export const alerts = pgTable("alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  subscriptionId: varchar("subscription_id"),
  alertType: text("alert_type").notNull().$type<"price_increase" | "unused_subscription" | "high_spending" | "trial_ending" | "renewal_reminder">(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  severity: text("severity").default("info").$type<"info" | "warning" | "critical">(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAlertSchema = createInsertSchema(alerts).omit({
  id: true,
  createdAt: true,
});
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alerts.$inferSelect;

export const currencyRates = pgTable("currency_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  baseCurrency: text("base_currency").notNull(),
  targetCurrency: text("target_currency").notNull(),
  rate: numeric("rate", { precision: 15, scale: 6 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type CurrencyRate = typeof currencyRates.$inferSelect;
