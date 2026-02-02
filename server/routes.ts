import type { Express } from "express";
import type { Server } from "http";
import { setupAuth, isAuthenticated } from "./auth";
import { storage } from "./storage";
import { insertSubscriptionSchema, insertUserPreferencesSchema } from "@shared/schema";
import { format, parseISO, differenceInMonths, startOfMonth, endOfMonth, addMonths, addYears } from "date-fns";

function calculateMonthlyEquivalent(cost: number, billingCycle: string, customMonths?: number | null): number {
  switch (billingCycle) {
    case "monthly":
      return cost;
    case "yearly":
      return cost / 12;
    case "custom":
      return customMonths ? cost / customMonths : cost;
    default:
      return cost;
  }
}

function getNextBillingDateFromToday(nextBillingDate: string, billingCycle: string, customMonths?: number | null): Date {
  const date = parseISO(nextBillingDate);
  const today = new Date();
  
  if (date >= today) return date;
  
  let newDate = date;
  while (newDate < today) {
    switch (billingCycle) {
      case "monthly":
        newDate = addMonths(newDate, 1);
        break;
      case "yearly":
        newDate = addYears(newDate, 1);
        break;
      case "custom":
        newDate = addMonths(newDate, customMonths || 1);
        break;
      default:
        return date;
    }
  }
  
  return newDate;
}

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
      
      await updateMonthlySnapshot(userId);
      
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
        "nextBillingDate", "status", "trialEndDate", "paymentMethod", "notes", 
        "reminderDays", "originalCurrency", "sharingType"
      ];
      const sanitizedData: Record<string, any> = {};
      for (const key of allowedFields) {
        if (key in updateData) {
          sanitizedData[key] = updateData[key];
        }
      }
      
      if (sanitizedData.cost && sanitizedData.cost !== existing.cost) {
        const oldCost = parseFloat(existing.cost);
        const newCost = parseFloat(sanitizedData.cost);
        
        await storage.createCostHistory({
          subscriptionId: id,
          userId,
          oldCost: existing.cost,
          newCost: sanitizedData.cost,
        });
        
        if (newCost > oldCost) {
          const increase = newCost - oldCost;
          await storage.createAlert({
            userId,
            subscriptionId: id,
            alertType: "price_increase",
            title: "Price Increase Detected",
            message: `${existing.serviceName} cost increased by $${increase.toFixed(2)} (from $${oldCost.toFixed(2)} to $${newCost.toFixed(2)})`,
            severity: "warning",
          });
        }
      }
      
      const sub = await storage.updateSubscription(id, userId, sanitizedData);
      
      await updateMonthlySnapshot(userId);
      
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
      
      await updateMonthlySnapshot(userId);
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting subscription:", error);
      res.status(500).json({ message: "Failed to delete subscription" });
    }
  });

  app.get("/api/subscriptions/:id/cost-history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      
      const sub = await storage.getSubscription(id, userId);
      if (!sub) {
        return res.status(404).json({ message: "Subscription not found" });
      }
      
      const history = await storage.getCostHistory(id, userId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching cost history:", error);
      res.status(500).json({ message: "Failed to fetch cost history" });
    }
  });

  app.post("/api/subscriptions/:id/view", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      
      await storage.updateLastViewed(id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating last viewed:", error);
      res.status(500).json({ message: "Failed to update" });
    }
  });

  app.get("/api/subscriptions/export", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const subs = await storage.getSubscriptions(userId);
      const cats = await storage.getCategories(userId);
      
      const categoryMap = new Map(cats.map(c => [c.id, c.name]));
      
      const header = "Service Name,Category,Cost,Currency,Billing Cycle,Next Billing Date,Status,Sharing Type,Payment Method,Notes\n";
      const rows = subs.map(sub => {
        const category = sub.categoryId ? categoryMap.get(sub.categoryId) || "" : "";
        return [
          `"${sub.serviceName.replace(/"/g, '""')}"`,
          `"${category}"`,
          sub.cost,
          sub.originalCurrency || "USD",
          sub.billingCycle === "custom" ? `every ${sub.customMonths} months` : sub.billingCycle,
          sub.nextBillingDate,
          sub.status,
          sub.sharingType || "personal",
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

  app.get("/api/insights", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const subs = await storage.getSubscriptions(userId);
      const cats = await storage.getCategories(userId);
      const prefs = await storage.getPreferences(userId);
      
      const activeSubs = subs.filter(s => s.status === "active" || s.status === "trial");
      
      let monthlyTotal = 0;
      const categorySpending: Record<string, { amount: number; name: string }> = {};
      const categoryMap = new Map(cats.map(c => [c.id, c.name]));
      
      activeSubs.forEach(sub => {
        const cost = parseFloat(sub.cost);
        const monthly = calculateMonthlyEquivalent(cost, sub.billingCycle, sub.customMonths);
        monthlyTotal += monthly;
        
        const catId = sub.categoryId || "uncategorized";
        const catName = sub.categoryId ? categoryMap.get(sub.categoryId) || "Unknown" : "Uncategorized";
        
        if (!categorySpending[catId]) {
          categorySpending[catId] = { amount: 0, name: catName };
        }
        categorySpending[catId].amount += monthly;
      });
      
      const yearlyTotal = monthlyTotal * 12;
      const avgCost = activeSubs.length > 0 ? monthlyTotal / activeSubs.length : 0;
      
      const sortedByCost = [...activeSubs].sort((a, b) => {
        const aCost = calculateMonthlyEquivalent(parseFloat(a.cost), a.billingCycle, a.customMonths);
        const bCost = calculateMonthlyEquivalent(parseFloat(b.cost), b.billingCycle, b.customMonths);
        return bCost - aCost;
      });
      
      const topSubscriptions = sortedByCost.slice(0, 5).map(sub => ({
        id: sub.id,
        serviceName: sub.serviceName,
        monthlyCost: calculateMonthlyEquivalent(parseFloat(sub.cost), sub.billingCycle, sub.customMonths),
        billingCycle: sub.billingCycle,
      }));
      
      const mostExpensive = topSubscriptions[0] || null;
      
      const categoryBreakdown = Object.entries(categorySpending)
        .map(([id, data]) => ({
          categoryId: id,
          categoryName: data.name,
          amount: data.amount,
          percentage: monthlyTotal > 0 ? (data.amount / monthlyTotal) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount);
      
      const personalTotal = activeSubs
        .filter(s => s.sharingType !== "shared")
        .reduce((sum, sub) => sum + calculateMonthlyEquivalent(parseFloat(sub.cost), sub.billingCycle, sub.customMonths), 0);
      
      const sharedTotal = activeSubs
        .filter(s => s.sharingType === "shared")
        .reduce((sum, sub) => sum + calculateMonthlyEquivalent(parseFloat(sub.cost), sub.billingCycle, sub.customMonths), 0);
      
      const spendingLimit = prefs?.monthlySpendingLimit ? parseFloat(prefs.monthlySpendingLimit) : null;
      const isOverBudget = spendingLimit !== null && monthlyTotal > spendingLimit;
      
      res.json({
        monthlyTotal,
        yearlyTotal,
        averageSubscriptionCost: avgCost,
        totalSubscriptions: activeSubs.length,
        mostExpensive,
        topSubscriptions,
        categoryBreakdown,
        personalTotal,
        sharedTotal,
        spendingLimit,
        isOverBudget,
        currency: prefs?.currency || "USD",
      });
    } catch (error) {
      console.error("Error fetching insights:", error);
      res.status(500).json({ message: "Failed to fetch insights" });
    }
  });

  app.get("/api/trends", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const snapshots = await storage.getMonthlySnapshots(userId, 12);
      res.json(snapshots);
    } catch (error) {
      console.error("Error fetching trends:", error);
      res.status(500).json({ message: "Failed to fetch trends" });
    }
  });

  app.get("/api/calendar", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { year, month } = req.query;
      
      const subs = await storage.getSubscriptions(userId);
      const activeSubs = subs.filter(s => s.status === "active" || s.status === "trial");
      
      const events: Array<{
        id: string;
        date: string;
        serviceName: string;
        cost: string;
        type: "billing" | "trial_end";
      }> = [];
      
      const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
      const targetMonth = month ? parseInt(month as string) : new Date().getMonth();
      
      const monthStart = startOfMonth(new Date(targetYear, targetMonth));
      const monthEnd = endOfMonth(new Date(targetYear, targetMonth));
      
      activeSubs.forEach(sub => {
        const billingDate = getNextBillingDateFromToday(sub.nextBillingDate, sub.billingCycle, sub.customMonths);
        
        if (billingDate >= monthStart && billingDate <= monthEnd) {
          events.push({
            id: sub.id,
            date: format(billingDate, "yyyy-MM-dd"),
            serviceName: sub.serviceName,
            cost: sub.cost,
            type: "billing",
          });
        }
        
        if (sub.status === "trial" && sub.trialEndDate) {
          const trialEnd = parseISO(sub.trialEndDate);
          if (trialEnd >= monthStart && trialEnd <= monthEnd) {
            events.push({
              id: sub.id + "-trial",
              date: sub.trialEndDate,
              serviceName: sub.serviceName,
              cost: sub.cost,
              type: "trial_end",
            });
          }
        }
      });
      
      events.sort((a, b) => a.date.localeCompare(b.date));
      
      res.json(events);
    } catch (error) {
      console.error("Error fetching calendar:", error);
      res.status(500).json({ message: "Failed to fetch calendar" });
    }
  });

  app.get("/api/alerts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { unread } = req.query;
      
      const alertsList = await storage.getAlerts(userId, unread === "true");
      res.json(alertsList);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  app.post("/api/alerts/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      
      await storage.markAlertRead(id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking alert read:", error);
      res.status(500).json({ message: "Failed to mark alert read" });
    }
  });

  app.post("/api/alerts/read-all", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await storage.markAllAlertsRead(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all alerts read:", error);
      res.status(500).json({ message: "Failed to mark alerts read" });
    }
  });

  app.delete("/api/alerts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      
      await storage.deleteAlert(id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting alert:", error);
      res.status(500).json({ message: "Failed to delete alert" });
    }
  });

  app.post("/api/alerts/check", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await generateSmartAlerts(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error checking alerts:", error);
      res.status(500).json({ message: "Failed to check alerts" });
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

  async function updateMonthlySnapshot(userId: string) {
    try {
      const subs = await storage.getSubscriptions(userId);
      const cats = await storage.getCategories(userId);
      const activeSubs = subs.filter(s => s.status === "active" || s.status === "trial");
      
      let monthlyTotal = 0;
      const categoryBreakdown: Record<string, number> = {};
      const categoryMap = new Map(cats.map(c => [c.id, c.name]));
      
      activeSubs.forEach(sub => {
        const cost = parseFloat(sub.cost);
        const monthly = calculateMonthlyEquivalent(cost, sub.billingCycle, sub.customMonths);
        monthlyTotal += monthly;
        
        const catName = sub.categoryId ? categoryMap.get(sub.categoryId) || "Unknown" : "Uncategorized";
        categoryBreakdown[catName] = (categoryBreakdown[catName] || 0) + monthly;
      });
      
      const now = new Date();
      await storage.createOrUpdateSnapshot({
        userId,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        totalMonthly: monthlyTotal.toFixed(2),
        totalYearly: (monthlyTotal * 12).toFixed(2),
        subscriptionCount: activeSubs.length,
        categoryBreakdown,
      });
    } catch (error) {
      console.error("Error updating monthly snapshot:", error);
    }
  }

  async function generateSmartAlerts(userId: string) {
    const subs = await storage.getSubscriptions(userId);
    const prefs = await storage.getPreferences(userId);
    const existingAlerts = await storage.getAlerts(userId);
    
    const activeSubs = subs.filter(s => s.status === "active" || s.status === "trial");
    
    let monthlyTotal = 0;
    activeSubs.forEach(sub => {
      const cost = parseFloat(sub.cost);
      monthlyTotal += calculateMonthlyEquivalent(cost, sub.billingCycle, sub.customMonths);
    });
    
    const spendingLimit = prefs?.monthlySpendingLimit ? parseFloat(prefs.monthlySpendingLimit) : null;
    if (spendingLimit && monthlyTotal > spendingLimit) {
      const hasExisting = existingAlerts.some(a => 
        a.alertType === "high_spending" && !a.isRead
      );
      
      if (!hasExisting) {
        await storage.createAlert({
          userId,
          alertType: "high_spending",
          title: "High Spending Warning",
          message: `Your monthly subscription cost ($${monthlyTotal.toFixed(2)}) exceeds your limit ($${spendingLimit.toFixed(2)})`,
          severity: "critical",
        });
      }
    }
    
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    for (const sub of activeSubs) {
      if (sub.lastViewedAt && new Date(sub.lastViewedAt) < sixMonthsAgo) {
        const hasExisting = existingAlerts.some(a => 
          a.alertType === "unused_subscription" && 
          a.subscriptionId === sub.id && 
          !a.isRead
        );
        
        if (!hasExisting) {
          await storage.createAlert({
            userId,
            subscriptionId: sub.id,
            alertType: "unused_subscription",
            title: "Unused Subscription?",
            message: `You haven't viewed ${sub.serviceName} in over 6 months. Are you still using it?`,
            severity: "info",
          });
        }
      }
      
      if (sub.status === "trial" && sub.trialEndDate) {
        const trialEnd = parseISO(sub.trialEndDate);
        const daysUntilEnd = Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilEnd <= 3 && daysUntilEnd > 0) {
          const hasExisting = existingAlerts.some(a => 
            a.alertType === "trial_ending" && 
            a.subscriptionId === sub.id && 
            !a.isRead
          );
          
          if (!hasExisting) {
            await storage.createAlert({
              userId,
              subscriptionId: sub.id,
              alertType: "trial_ending",
              title: "Trial Ending Soon",
              message: `${sub.serviceName} trial ends in ${daysUntilEnd} day${daysUntilEnd !== 1 ? 's' : ''}`,
              severity: "warning",
            });
          }
        }
      }
    }
  }

  return httpServer;
}
