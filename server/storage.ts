import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import {
  subscriptions,
  categories,
  userPreferences,
  users,
  type Subscription,
  type InsertSubscription,
  type Category,
  type InsertCategory,
  type UserPreferences,
  type InsertUserPreferences,
  type User,
  type UpsertUser,
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
  
  // Category methods
  getCategories(userId: string): Promise<Category[]>;
  createCategory(data: InsertCategory): Promise<Category>;
  
  // Preference methods
  getPreferences(userId: string): Promise<UserPreferences | undefined>;
  upsertPreferences(data: InsertUserPreferences): Promise<UserPreferences>;
  
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
