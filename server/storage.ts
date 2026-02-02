import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import {
  subscriptions,
  categories,
  userPreferences,
  type Subscription,
  type InsertSubscription,
  type Category,
  type InsertCategory,
  type UserPreferences,
  type InsertUserPreferences,
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
  getSubscriptions(userId: string): Promise<Subscription[]>;
  getSubscription(id: string, userId: string): Promise<Subscription | undefined>;
  createSubscription(data: InsertSubscription): Promise<Subscription>;
  updateSubscription(id: string, userId: string, data: Partial<InsertSubscription>): Promise<Subscription | undefined>;
  deleteSubscription(id: string, userId: string): Promise<boolean>;
  
  getCategories(userId: string): Promise<Category[]>;
  createCategory(data: InsertCategory): Promise<Category>;
  
  getPreferences(userId: string): Promise<UserPreferences | undefined>;
  upsertPreferences(data: InsertUserPreferences): Promise<UserPreferences>;
  
  deleteUserData(userId: string): Promise<void>;
  seedDefaultCategories(): Promise<void>;
}

class DatabaseStorage implements IStorage {
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
    const [sub] = await db.insert(subscriptions).values(data).returning();
    return sub;
  }

  async updateSubscription(
    id: string,
    userId: string,
    data: Partial<InsertSubscription>
  ): Promise<Subscription | undefined> {
    const [sub] = await db
      .update(subscriptions)
      .set(data)
      .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)))
      .returning();
    return sub;
  }

  async deleteSubscription(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(subscriptions)
      .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)));
    return true;
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
        },
      })
      .returning();
    return prefs;
  }

  async deleteUserData(userId: string): Promise<void> {
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
