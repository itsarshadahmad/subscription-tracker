import { db } from "./db";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";
import {
  subscriptions,
  categories,
  userPreferences,
  users,
  costHistory,
  monthlySnapshots,
  alerts,
  currencyRates,
  type Subscription,
  type InsertSubscription,
  type Category,
  type InsertCategory,
  type UserPreferences,
  type InsertUserPreferences,
  type User,
  type UpsertUser,
  type CostHistory,
  type InsertCostHistory,
  type MonthlySnapshot,
  type InsertMonthlySnapshot,
  type Alert,
  type InsertAlert,
  type CurrencyRate,
} from "@shared/schema";

const DEFAULT_CATEGORIES = [
  "Entertainment",
  "Work / SaaS",
  "Education",
  "Utilities",
  "Health & Fitness",
  "Shopping",
  "Other",
];

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(data: UpsertUser): Promise<User>;
  updateUser(id: string, data: Partial<UpsertUser>): Promise<User | undefined>;
  
  // Subscription methods
  getSubscriptions(userId: string): Promise<Subscription[]>;
  getSubscription(id: string, userId: string): Promise<Subscription | undefined>;
  createSubscription(data: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: string, userId: string, data: Partial<InsertSubscription>): Promise<Subscription | undefined>;
  deleteSubscription(id: string, userId: string): Promise<boolean>;
  updateLastViewed(id: string, userId: string): Promise<void>;
  
  // Category methods
  getCategories(userId: string): Promise<Category[]>;
  createCategory(data: InsertCategory): Promise<Category>;
  
  // Preference methods
  getPreferences(userId: string): Promise<UserPreferences | undefined>;
  upsertPreferences(data: InsertUserPreferences): Promise<UserPreferences>;
  
  // Cost history methods
  getCostHistory(subscriptionId: string, userId: string): Promise<CostHistory[]>;
  createCostHistory(data: InsertCostHistory): Promise<CostHistory>;
  
  // Monthly snapshots methods
  getMonthlySnapshots(userId: string, limit?: number): Promise<MonthlySnapshot[]>;
  createOrUpdateSnapshot(data: InsertMonthlySnapshot): Promise<MonthlySnapshot>;
  
  // Alerts methods
  getAlerts(userId: string, unreadOnly?: boolean): Promise<Alert[]>;
  createAlert(data: InsertAlert): Promise<Alert>;
  markAlertRead(id: string, userId: string): Promise<void>;
  markAllAlertsRead(userId: string): Promise<void>;
  deleteAlert(id: string, userId: string): Promise<void>;
  
  // Currency methods
  getCurrencyRate(baseCurrency: string, targetCurrency: string): Promise<CurrencyRate | undefined>;
  upsertCurrencyRate(baseCurrency: string, targetCurrency: string, rate: string): Promise<CurrencyRate>;
  
  // Cleanup methods
  deleteUserData(userId: string): Promise<void>;
  seedDefaultCategories(): Promise<void>;
}

class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(data: UpsertUser): Promise<User> {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<UpsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Subscription methods
  async getSubscriptions(userId: string): Promise<Subscription[]> {
    return db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
  }

  async getSubscription(id: string, userId: string): Promise<Subscription | undefined> {
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)));
    return sub;
  }

  async createSubscription(data: InsertSubscription): Promise<Subscription> {
    const [sub] = await db.insert(subscriptions).values(data as any).returning();
    return sub;
  }

  async updateSubscription(
    id: string,
    userId: string,
    data: Partial<InsertSubscription>
  ): Promise<Subscription | undefined> {
    const [sub] = await db
      .update(subscriptions)
      .set(data as any)
      .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)))
      .returning();
    return sub;
  }

  async deleteSubscription(id: string, userId: string): Promise<boolean> {
    await db.delete(costHistory).where(eq(costHistory.subscriptionId, id));
    await db
      .delete(subscriptions)
      .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)));
    return true;
  }

  async updateLastViewed(id: string, userId: string): Promise<void> {
    await db
      .update(subscriptions)
      .set({ lastViewedAt: new Date() })
      .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)));
  }

  async getCategories(userId: string): Promise<Category[]> {
    return db
      .select()
      .from(categories)
      .where(
        sql`${categories.isDefault} = true OR ${categories.userId} = ${userId}`
      );
  }

  async createCategory(data: InsertCategory): Promise<Category> {
    const [cat] = await db.insert(categories).values(data).returning();
    return cat;
  }

  async getPreferences(userId: string): Promise<UserPreferences | undefined> {
    const [prefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));
    return prefs;
  }

  async upsertPreferences(data: InsertUserPreferences): Promise<UserPreferences> {
    const [prefs] = await db
      .insert(userPreferences)
      .values(data)
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: {
          currency: data.currency,
          timezone: data.timezone,
          displayName: data.displayName,
          monthlySpendingLimit: data.monthlySpendingLimit,
        },
      })
      .returning();
    return prefs;
  }

  // Cost history methods
  async getCostHistory(subscriptionId: string, userId: string): Promise<CostHistory[]> {
    return db
      .select()
      .from(costHistory)
      .where(and(eq(costHistory.subscriptionId, subscriptionId), eq(costHistory.userId, userId)))
      .orderBy(desc(costHistory.changedAt));
  }

  async createCostHistory(data: InsertCostHistory): Promise<CostHistory> {
    const [history] = await db.insert(costHistory).values(data).returning();
    return history;
  }

  // Monthly snapshots methods
  async getMonthlySnapshots(userId: string, limit = 12): Promise<MonthlySnapshot[]> {
    return db
      .select()
      .from(monthlySnapshots)
      .where(eq(monthlySnapshots.userId, userId))
      .orderBy(desc(monthlySnapshots.year), desc(monthlySnapshots.month))
      .limit(limit);
  }

  async createOrUpdateSnapshot(data: InsertMonthlySnapshot): Promise<MonthlySnapshot> {
    const existing = await db
      .select()
      .from(monthlySnapshots)
      .where(
        and(
          eq(monthlySnapshots.userId, data.userId),
          eq(monthlySnapshots.year, data.year),
          eq(monthlySnapshots.month, data.month)
        )
      );

    if (existing.length > 0) {
      const [snapshot] = await db
        .update(monthlySnapshots)
        .set({
          totalMonthly: data.totalMonthly,
          totalYearly: data.totalYearly,
          subscriptionCount: data.subscriptionCount,
          categoryBreakdown: data.categoryBreakdown,
        })
        .where(eq(monthlySnapshots.id, existing[0].id))
        .returning();
      return snapshot;
    }

    const [snapshot] = await db.insert(monthlySnapshots).values(data).returning();
    return snapshot;
  }

  // Alerts methods
  async getAlerts(userId: string, unreadOnly = false): Promise<Alert[]> {
    if (unreadOnly) {
      return db
        .select()
        .from(alerts)
        .where(and(eq(alerts.userId, userId), eq(alerts.isRead, false)))
        .orderBy(desc(alerts.createdAt));
    }
    return db
      .select()
      .from(alerts)
      .where(eq(alerts.userId, userId))
      .orderBy(desc(alerts.createdAt));
  }

  async createAlert(data: InsertAlert): Promise<Alert> {
    const [alert] = await db.insert(alerts).values(data as any).returning();
    return alert;
  }

  async markAlertRead(id: string, userId: string): Promise<void> {
    await db
      .update(alerts)
      .set({ isRead: true })
      .where(and(eq(alerts.id, id), eq(alerts.userId, userId)));
  }

  async markAllAlertsRead(userId: string): Promise<void> {
    await db
      .update(alerts)
      .set({ isRead: true })
      .where(eq(alerts.userId, userId));
  }

  async deleteAlert(id: string, userId: string): Promise<void> {
    await db.delete(alerts).where(and(eq(alerts.id, id), eq(alerts.userId, userId)));
  }

  // Currency methods
  async getCurrencyRate(baseCurrency: string, targetCurrency: string): Promise<CurrencyRate | undefined> {
    const [rate] = await db
      .select()
      .from(currencyRates)
      .where(
        and(
          eq(currencyRates.baseCurrency, baseCurrency),
          eq(currencyRates.targetCurrency, targetCurrency)
        )
      );
    return rate;
  }

  async upsertCurrencyRate(baseCurrency: string, targetCurrency: string, rate: string): Promise<CurrencyRate> {
    const existing = await this.getCurrencyRate(baseCurrency, targetCurrency);
    
    if (existing) {
      const [updated] = await db
        .update(currencyRates)
        .set({ rate, updatedAt: new Date() })
        .where(eq(currencyRates.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(currencyRates)
      .values({ baseCurrency, targetCurrency, rate })
      .returning();
    return created;
  }

  async deleteUserData(userId: string): Promise<void> {
    await db.delete(alerts).where(eq(alerts.userId, userId));
    await db.delete(monthlySnapshots).where(eq(monthlySnapshots.userId, userId));
    await db.delete(costHistory).where(eq(costHistory.userId, userId));
    await db.delete(subscriptions).where(eq(subscriptions.userId, userId));
    await db.delete(userPreferences).where(eq(userPreferences.userId, userId));
    await db.delete(categories).where(eq(categories.userId, userId));
  }

  async seedDefaultCategories(): Promise<void> {
    const existing = await db.select().from(categories).where(eq(categories.isDefault, true));
    if (existing.length === 0) {
      await db.insert(categories).values(
        DEFAULT_CATEGORIES.map(name => ({
          name,
          isDefault: true,
          userId: null,
        }))
      );
    }
  }
}

export const storage = new DatabaseStorage();
