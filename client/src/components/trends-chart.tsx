import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MonthlySnapshot {
  id: string;
  userId: string;
  year: number;
  month: number;
  totalMonthly: string;
  totalYearly: string;
  subscriptionCount: number;
  categoryBreakdown: Record<string, number>;
  createdAt: string;
}

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getMonthName(month: number) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months[month - 1];
}

export function TrendsChart() {
  const { data: snapshots = [], isLoading } = useQuery<MonthlySnapshot[]>({
    queryKey: ["/api/trends"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  const sortedSnapshots = [...snapshots].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  const maxValue = Math.max(...sortedSnapshots.map(s => parseFloat(s.totalMonthly)), 1);
  const minValue = Math.min(...sortedSnapshots.map(s => parseFloat(s.totalMonthly)), 0);
  const range = maxValue - minValue || 1;

  const current = sortedSnapshots.length > 0 ? parseFloat(sortedSnapshots[sortedSnapshots.length - 1].totalMonthly) : 0;
  const previous = sortedSnapshots.length > 1 ? parseFloat(sortedSnapshots[sortedSnapshots.length - 2].totalMonthly) : current;
  const change = current - previous;
  const changePercent = previous > 0 ? ((change / previous) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Spending Trends
          </CardTitle>
          {sortedSnapshots.length > 1 && (
            <div className="flex items-center gap-1 text-sm">
              {change > 0 ? (
                <>
                  <TrendingUp className="h-4 w-4 text-destructive" />
                  <span className="text-destructive">+{formatCurrency(change)}</span>
                </>
              ) : change < 0 ? (
                <>
                  <TrendingDown className="h-4 w-4 text-green-500" />
                  <span className="text-green-500">{formatCurrency(change)}</span>
                </>
              ) : (
                <>
                  <Minus className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">No change</span>
                </>
              )}
              <span className="text-muted-foreground text-xs">vs last month</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {sortedSnapshots.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <TrendingUp className="h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">No trend data yet</p>
            <p className="text-xs text-muted-foreground">
              Add or update subscriptions to see trends
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-end gap-1 h-40">
              {sortedSnapshots.slice(-12).map((snapshot, index) => {
                const value = parseFloat(snapshot.totalMonthly);
                const height = ((value - minValue) / range) * 100;
                const isLatest = index === sortedSnapshots.slice(-12).length - 1;
                
                return (
                  <div
                    key={`${snapshot.year}-${snapshot.month}`}
                    className="flex-1 flex flex-col items-center gap-1"
                    data-testid={`trend-bar-${snapshot.year}-${snapshot.month}`}
                  >
                    <div className="w-full flex flex-col justify-end h-32">
                      <div
                        className={`w-full rounded-t ${isLatest ? "bg-primary" : "bg-primary/40"} transition-all duration-300`}
                        style={{ height: `${Math.max(height, 5)}%` }}
                        title={`${getMonthName(snapshot.month)} ${snapshot.year}: ${formatCurrency(value)}`}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {getMonthName(snapshot.month)}
                    </span>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Current</p>
                <p className="text-lg font-semibold">{formatCurrency(current)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Average</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(
                    sortedSnapshots.reduce((sum, s) => sum + parseFloat(s.totalMonthly), 0) / sortedSnapshots.length
                  )}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Peak</p>
                <p className="text-lg font-semibold">{formatCurrency(maxValue)}</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
