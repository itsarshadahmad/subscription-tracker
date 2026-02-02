import type { Express } from "express";
import type { Server } from "http";
import { setupAuth, isAuthenticated } from "./auth";
import { storage } from "./storage";
import { insertSubscriptionSchema, insertUserPreferencesSchema } from "@shared/schema";
import { format } from "date-fns";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  await storage.seedDefaultCategories();

  app.get("/api/subscriptions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const subs = await storage.getSubscriptions(userId);
      res.json(subs);
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
      res.status(500).json({ message: "Failed to fetch subscriptions" });
    }
  });

  app.post("/api/subscriptions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const parsed = insertSubscriptionSchema.parse({
        ...req.body,
        userId,
      });
      const sub = await storage.createSubscription(parsed);
      res.status(201).json(sub);
    } catch (error: any) {
      console.error("Error creating subscription:", error);
      res.status(400).json({ message: error.message || "Failed to create subscription" });
    }
  });

  app.patch("/api/subscriptions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      
      const existing = await storage.getSubscription(id, userId);
      if (!existing) {
        return res.status(404).json({ message: "Subscription not found" });
      }

      const updateData = { ...req.body };
      delete updateData.userId;
      delete updateData.id;
      delete updateData.createdAt;
      
      const allowedFields = [
        "serviceName", "categoryId", "cost", "billingCycle", "customMonths",
        "nextBillingDate", "status", "trialEndDate", "paymentMethod", "notes", "reminderDays"
      ];
      const sanitizedData: Record<string, any> = {};
      for (const key of allowedFields) {
        if (key in updateData) {
          sanitizedData[key] = updateData[key];
        }
      }
      
      const sub = await storage.updateSubscription(id, userId, sanitizedData);
      res.json(sub);
    } catch (error: any) {
      console.error("Error updating subscription:", error);
      res.status(400).json({ message: error.message || "Failed to update subscription" });
    }
  });

  app.delete("/api/subscriptions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      
      const existing = await storage.getSubscription(id, userId);
      if (!existing) {
        return res.status(404).json({ message: "Subscription not found" });
      }

      await storage.deleteSubscription(id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting subscription:", error);
      res.status(500).json({ message: "Failed to delete subscription" });
    }
  });

  app.get("/api/subscriptions/export", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const subs = await storage.getSubscriptions(userId);
      const cats = await storage.getCategories(userId);
      
      const categoryMap = new Map(cats.map(c => [c.id, c.name]));
      
      const header = "Service Name,Category,Cost,Billing Cycle,Next Billing Date,Status,Payment Method,Notes\n";
      const rows = subs.map(sub => {
        const category = sub.categoryId ? categoryMap.get(sub.categoryId) || "" : "";
        return [
          `"${sub.serviceName.replace(/"/g, '""')}"`,
          `"${category}"`,
          sub.cost,
          sub.billingCycle === "custom" ? `every ${sub.customMonths} months` : sub.billingCycle,
          sub.nextBillingDate,
          sub.status,
          `"${(sub.paymentMethod || "").replace(/"/g, '""')}"`,
          `"${(sub.notes || "").replace(/"/g, '""')}"`,
        ].join(",");
      }).join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=subscriptions-${format(new Date(), "yyyy-MM-dd")}.csv`);
      res.send(header + rows);
    } catch (error) {
      console.error("Error exporting subscriptions:", error);
      res.status(500).json({ message: "Failed to export subscriptions" });
    }
  });

  app.get("/api/categories", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const cats = await storage.getCategories(userId);
      res.json(cats);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post("/api/categories", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { name } = req.body;
      
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ message: "Category name is required" });
      }
      
      const cat = await storage.createCategory({
        name: name.trim(),
        userId,
        isDefault: false,
      });
      res.status(201).json(cat);
    } catch (error: any) {
      console.error("Error creating category:", error);
      res.status(400).json({ message: error.message || "Failed to create category" });
    }
  });

  app.get("/api/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      let prefs = await storage.getPreferences(userId);
      
      if (!prefs) {
        prefs = await storage.upsertPreferences({
          userId,
          currency: "USD",
          timezone: "America/New_York",
        });
      }
      
      res.json(prefs);
    } catch (error) {
      console.error("Error fetching preferences:", error);
      res.status(500).json({ message: "Failed to fetch preferences" });
    }
  });

  app.put("/api/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const parsed = insertUserPreferencesSchema.parse({
        ...req.body,
        userId,
      });
      const prefs = await storage.upsertPreferences(parsed);
      res.json(prefs);
    } catch (error: any) {
      console.error("Error updating preferences:", error);
      res.status(400).json({ message: error.message || "Failed to update preferences" });
    }
  });

  app.delete("/api/account", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await storage.deleteUserData(userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting account:", error);
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  return httpServer;
}
