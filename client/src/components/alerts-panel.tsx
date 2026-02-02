import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, BellOff, TrendingUp, AlertTriangle, Clock, X, CheckCheck } from "lucide-react";
import { format, parseISO } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Alert {
  id: string;
  userId: string;
  subscriptionId: string | null;
  alertType: "price_increase" | "renewal_reminder" | "trial_ending" | "high_spending" | "unused_subscription";
  title: string;
  message: string;
  severity: "info" | "warning" | "critical" | null;
  isRead: boolean;
  createdAt: string;
}

const alertIcons: Record<string, React.ElementType> = {
  price_increase: TrendingUp,
  renewal_reminder: Clock,
  trial_ending: Clock,
  high_spending: AlertTriangle,
  unused_subscription: BellOff,
};

const severityColors: Record<string, string> = {
  info: "text-blue-500",
  warning: "text-chart-5",
  critical: "text-destructive",
};

export function AlertsPanel() {
  const { toast } = useToast();

  const { data: alerts = [], isLoading } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/alerts/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/alerts/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      toast({ title: "All alerts marked as read" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/alerts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
    },
  });

  const unreadCount = alerts.filter(a => !a.isRead).length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alerts
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Mark all read
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <Bell className="h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">No alerts yet</p>
            <p className="text-xs text-muted-foreground">
              We'll notify you about price changes and renewals
            </p>
          </div>
        ) : (
          alerts.slice(0, 5).map((alert) => {
            const Icon = alertIcons[alert.alertType] || Bell;
            const colorClass = alert.severity ? severityColors[alert.severity] : "text-muted-foreground";
            
            return (
              <div
                key={alert.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${!alert.isRead ? "bg-muted/30" : ""}`}
                data-testid={`alert-${alert.id}`}
              >
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${colorClass}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={`text-sm font-medium ${!alert.isRead ? "" : "text-muted-foreground"}`}>
                        {alert.title}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {alert.message}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!alert.isRead && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => deleteMutation.mutate(alert.id)}
                        data-testid={`button-dismiss-${alert.id}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(alert.createdAt), "MMM d, h:mm a")}
                    </span>
                    {!alert.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-xs underline hover:no-underline"
                        onClick={() => markReadMutation.mutate(alert.id)}
                      >
                        Mark read
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
