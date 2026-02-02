import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, PieChart, Users, User, AlertTriangle } from "lucide-react";

interface InsightsData {
  monthlyTotal: number;
  yearlyTotal: number;
  averageSubscriptionCost: number;
  totalSubscriptions: number;
  mostExpensive: {
    id: string;
    serviceName: string;
    monthlyCost: number;
    billingCycle: string;
  } | null;
  topSubscriptions: Array<{
    id: string;
    serviceName: string;
    monthlyCost: number;
    billingCycle: string;
  }>;
  categoryBreakdown: Array<{
    categoryId: string;
    categoryName: string;
    amount: number;
    percentage: number;
  }>;
  personalTotal: number;
  sharedTotal: number;
  spendingLimit: number | null;
  isOverBudget: boolean;
  currency: string;
}

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

const CATEGORY_COLORS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
  "bg-primary/50",
  "bg-muted-foreground/50",
];

export function InsightsPanel() {
  const { data: insights, isLoading } = useQuery<InsightsData>({
    queryKey: ["/api/insights"],
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!insights || insights.totalSubscriptions === 0) {
    return null;
  }

  const currency = insights.currency || "USD";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            Spending by Category
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {insights.categoryBreakdown.slice(0, 5).map((cat, index) => (
            <div key={cat.categoryId} className="space-y-1.5" data-testid={`category-breakdown-${cat.categoryId}`}>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-sm ${CATEGORY_COLORS[index % CATEGORY_COLORS.length]}`} />
                  <span className="truncate max-w-[140px]">{cat.categoryName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{cat.percentage.toFixed(0)}%</span>
                  <span className="font-medium">{formatCurrency(cat.amount, currency)}</span>
                </div>
              </div>
              <Progress value={cat.percentage} className="h-1.5" />
            </div>
          ))}
          {insights.categoryBreakdown.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Assign categories to see breakdown
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Top Subscriptions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {insights.topSubscriptions.slice(0, 5).map((sub, index) => (
            <div key={sub.id} className="flex items-center justify-between" data-testid={`top-sub-${sub.id}`}>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground text-sm w-4">{index + 1}.</span>
                <span className="text-sm font-medium truncate max-w-[160px]">{sub.serviceName}</span>
              </div>
              <span className="text-sm font-medium">{formatCurrency(sub.monthlyCost, currency)}/mo</span>
            </div>
          ))}
          {insights.topSubscriptions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No active subscriptions
            </p>
          )}
        </CardContent>
      </Card>

      {(insights.sharedTotal > 0 || insights.personalTotal > 0) && (
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Personal vs Shared
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 flex items-center gap-3 p-3 rounded-lg bg-muted/50" data-testid="personal-spending">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Personal</p>
                  <p className="text-lg font-semibold">{formatCurrency(insights.personalTotal, currency)}/mo</p>
                </div>
              </div>
              <div className="flex-1 flex items-center gap-3 p-3 rounded-lg bg-muted/50" data-testid="shared-spending">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Shared / Household</p>
                  <p className="text-lg font-semibold">{formatCurrency(insights.sharedTotal, currency)}/mo</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {insights.spendingLimit && (
        <Card className={`md:col-span-2 ${insights.isOverBudget ? "border-destructive/50" : ""}`}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {insights.isOverBudget && <AlertTriangle className="h-4 w-4 text-destructive" />}
                <span className="font-medium">Monthly Budget</span>
              </div>
              <div className="text-sm">
                <span className={insights.isOverBudget ? "text-destructive font-medium" : ""}>
                  {formatCurrency(insights.monthlyTotal, currency)}
                </span>
                <span className="text-muted-foreground"> / {formatCurrency(insights.spendingLimit, currency)}</span>
              </div>
            </div>
            <Progress 
              value={Math.min((insights.monthlyTotal / insights.spendingLimit) * 100, 100)} 
              className={`h-2 ${insights.isOverBudget ? "[&>div]:bg-destructive" : ""}`}
            />
            {insights.isOverBudget && (
              <p className="text-sm text-destructive mt-2">
                You're {formatCurrency(insights.monthlyTotal - insights.spendingLimit, currency)} over budget
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
