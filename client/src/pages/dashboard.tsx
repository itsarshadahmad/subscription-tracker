import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, DollarSign, Calendar, CreditCard, AlertTriangle, Pencil, Trash2, ArrowUpDown, Download, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState, useMemo, useCallback } from "react";
import { format, differenceInDays, parseISO, addMonths, addYears } from "date-fns";
import type { Subscription, Category, UserPreferences } from "@shared/schema";
import { SubscriptionDialog } from "@/components/subscription-dialog";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/auth-utils";

type SortField = "cost" | "nextBillingDate" | "serviceName";
type SortOrder = "asc" | "desc";

interface DashboardStats {
  monthlyTotal: number;
  yearlyTotal: number;
  upcomingRenewals: number;
  activeSubscriptions: number;
}

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

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

function getNextBillingDateFromToday(nextBillingDate: string, billingCycle: string, customMonths?: number | null): string {
  const date = parseISO(nextBillingDate);
  const today = new Date();
  
  if (date >= today) return nextBillingDate;
  
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
        return nextBillingDate;
    }
  }
  
  return format(newDate, "yyyy-MM-dd");
}

export default function Dashboard() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [cycleFilter, setCycleFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("nextBillingDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingSubscription, setDeletingSubscription] = useState<Subscription | null>(null);

  const { data: subscriptions = [], isLoading: subsLoading } = useQuery<Subscription[]>({
    queryKey: ["/api/subscriptions"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: preferences } = useQuery<UserPreferences>({
    queryKey: ["/api/preferences"],
  });

  const currency = preferences?.currency || "USD";
  
  const formatMoney = useCallback((amount: number) => {
    return formatCurrency(amount, currency);
  }, [currency]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/subscriptions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      toast({ title: "Subscription deleted" });
      setDeleteDialogOpen(false);
      setDeletingSubscription(null);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Session expired", description: "Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/subscriptions/export");
      return response.blob();
    },
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `subscriptions-${format(new Date(), "yyyy-MM-dd")}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: "Export downloaded" });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Session expired", description: "Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({ title: "Export failed", description: error.message, variant: "destructive" });
    },
  });

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach(cat => map.set(cat.id, cat.name));
    return map;
  }, [categories]);

  const stats: DashboardStats = useMemo(() => {
    const activeAndTrial = subscriptions.filter(s => s.status !== "cancelled");
    const today = new Date();
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    let monthlyTotal = 0;
    activeAndTrial.forEach(sub => {
      monthlyTotal += calculateMonthlyEquivalent(
        parseFloat(sub.cost),
        sub.billingCycle,
        sub.customMonths
      );
    });

    const upcomingRenewals = activeAndTrial.filter(sub => {
      const nextDate = parseISO(getNextBillingDateFromToday(sub.nextBillingDate, sub.billingCycle, sub.customMonths));
      return nextDate >= today && nextDate <= thirtyDaysFromNow;
    }).length;

    return {
      monthlyTotal,
      yearlyTotal: monthlyTotal * 12,
      upcomingRenewals,
      activeSubscriptions: activeAndTrial.length,
    };
  }, [subscriptions]);

  const trialsEndingSoon = useMemo(() => {
    const today = new Date();
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    return subscriptions.filter(sub => {
      if (sub.status !== "trial" || !sub.trialEndDate) return false;
      const trialEnd = parseISO(sub.trialEndDate);
      return trialEnd >= today && trialEnd <= sevenDaysFromNow;
    });
  }, [subscriptions]);

  const filteredAndSortedSubscriptions = useMemo(() => {
    let filtered = subscriptions;

    if (searchQuery) {
      filtered = filtered.filter(sub =>
        sub.serviceName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter(sub => sub.categoryId === categoryFilter);
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(sub => sub.status === statusFilter);
    }

    if (cycleFilter !== "all") {
      filtered = filtered.filter(sub => sub.billingCycle === cycleFilter);
    }

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "cost":
          comparison = parseFloat(a.cost) - parseFloat(b.cost);
          break;
        case "nextBillingDate":
          comparison = new Date(a.nextBillingDate).getTime() - new Date(b.nextBillingDate).getTime();
          break;
        case "serviceName":
          comparison = a.serviceName.localeCompare(b.serviceName);
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [subscriptions, searchQuery, categoryFilter, statusFilter, cycleFilter, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleEdit = (subscription: Subscription) => {
    setEditingSubscription(subscription);
    setDialogOpen(true);
  };

  const handleDelete = (subscription: Subscription) => {
    setDeletingSubscription(subscription);
    setDeleteDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingSubscription(null);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "trial":
        return "secondary";
      case "cancelled":
        return "outline";
      default:
        return "default";
    }
  };

  const getDaysUntilRenewal = (dateStr: string, billingCycle: string, customMonths?: number | null) => {
    const nextDate = getNextBillingDateFromToday(dateStr, billingCycle, customMonths);
    return differenceInDays(parseISO(nextDate), new Date());
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {trialsEndingSoon.length > 0 && (
        <Card className="border-chart-5/50 bg-chart-5/5">
          <CardContent className="flex items-start sm:items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-chart-5 shrink-0 mt-0.5 sm:mt-0" />
            <div className="min-w-0">
              <p className="font-medium">Trials ending soon</p>
              <p className="text-sm text-muted-foreground truncate">
                {trialsEndingSoon.map(s => s.serviceName).join(", ")} - ending within 7 days
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Monthly Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent>
            {subsLoading ? (
              <Skeleton className="h-7 sm:h-8 w-20 sm:w-24" />
            ) : (
              <div className="text-xl sm:text-2xl font-bold" data-testid="text-monthly-cost">
                {formatMoney(stats.monthlyTotal)}
              </div>
            )}
            <p className="text-xs text-muted-foreground hidden sm:block">Active subscriptions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Yearly Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent>
            {subsLoading ? (
              <Skeleton className="h-7 sm:h-8 w-20 sm:w-24" />
            ) : (
              <div className="text-xl sm:text-2xl font-bold" data-testid="text-yearly-cost">
                {formatMoney(stats.yearlyTotal)}
              </div>
            )}
            <p className="text-xs text-muted-foreground hidden sm:block">Projected annual</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Upcoming</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent>
            {subsLoading ? (
              <Skeleton className="h-7 sm:h-8 w-12 sm:w-16" />
            ) : (
              <div className="text-xl sm:text-2xl font-bold" data-testid="text-upcoming-renewals">
                {stats.upcomingRenewals}
              </div>
            )}
            <p className="text-xs text-muted-foreground hidden sm:block">Next 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Active</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent>
            {subsLoading ? (
              <Skeleton className="h-7 sm:h-8 w-12 sm:w-16" />
            ) : (
              <div className="text-xl sm:text-2xl font-bold" data-testid="text-active-count">
                {stats.activeSubscriptions}
              </div>
            )}
            <p className="text-xs text-muted-foreground hidden sm:block">Currently tracking</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg sm:text-xl">Subscriptions</CardTitle>
            <div className="flex items-center gap-2">
              <Button 
                onClick={() => exportMutation.mutate()} 
                variant="outline" 
                size="default" 
                disabled={exportMutation.isPending} 
                data-testid="button-export"
                className="flex-1 sm:flex-none"
              >
                <Download className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Export CSV</span>
                <span className="sm:hidden">Export</span>
              </Button>
              <Button onClick={() => setDialogOpen(true)} data-testid="button-add-subscription" className="flex-1 sm:flex-none">
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Add Subscription</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 sm:mb-6 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search subscriptions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-[140px]" data-testid="select-category-filter">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="flex-1 sm:w-[130px] sm:flex-none" data-testid="select-status-filter">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={cycleFilter} onValueChange={setCycleFilter}>
                <SelectTrigger className="flex-1 sm:w-[130px] sm:flex-none" data-testid="select-cycle-filter">
                  <SelectValue placeholder="Billing" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cycles</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {subsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-16 sm:h-14 w-full" />
              ))}
            </div>
          ) : filteredAndSortedSubscriptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CreditCard className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No subscriptions found</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-xs">
                {subscriptions.length === 0 
                  ? "Add your first subscription to start tracking your spending"
                  : "Try adjusting your search or filters"
                }
              </p>
              {subscriptions.length === 0 && (
                <Button className="mt-4" onClick={() => setDialogOpen(true)} data-testid="button-add-first">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Subscription
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block lg:hidden space-y-3">
                {filteredAndSortedSubscriptions.map((sub) => {
                  const daysUntil = getDaysUntilRenewal(sub.nextBillingDate, sub.billingCycle, sub.customMonths);
                  return (
                    <Card key={sub.id} className="overflow-hidden" data-testid={`card-subscription-${sub.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium truncate">{sub.serviceName}</h4>
                              <Badge variant={getStatusBadgeVariant(sub.status)} className="shrink-0">
                                {sub.status}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                              <span className="font-medium text-foreground">
                                {formatMoney(parseFloat(sub.cost))}
                                <span className="text-muted-foreground font-normal">
                                  /{sub.billingCycle === "custom" ? `${sub.customMonths}mo` : sub.billingCycle === "yearly" ? "yr" : "mo"}
                                </span>
                              </span>
                              {sub.categoryId && (
                                <span>{categoryMap.get(sub.categoryId)}</span>
                              )}
                            </div>
                            <div className="mt-2 text-sm">
                              <span className="text-muted-foreground">Next: </span>
                              <span>{format(parseISO(getNextBillingDateFromToday(sub.nextBillingDate, sub.billingCycle, sub.customMonths)), "MMM d, yyyy")}</span>
                              {sub.status !== "cancelled" && (
                                <span className={`ml-1.5 ${daysUntil <= 7 ? "text-chart-5" : "text-muted-foreground"}`}>
                                  ({daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `${daysUntil}d`})
                                </span>
                              )}
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="shrink-0" data-testid={`button-menu-${sub.id}`}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(sub)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDelete(sub)} className="text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <Button variant="ghost" size="sm" className="gap-1 -ml-3" onClick={() => handleSort("serviceName")}>
                          Service
                          <ArrowUpDown className="h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>
                        <Button variant="ghost" size="sm" className="gap-1 -ml-3" onClick={() => handleSort("cost")}>
                          Cost
                          <ArrowUpDown className="h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead>Cycle</TableHead>
                      <TableHead>
                        <Button variant="ghost" size="sm" className="gap-1 -ml-3" onClick={() => handleSort("nextBillingDate")}>
                          Next Billing
                          <ArrowUpDown className="h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedSubscriptions.map((sub) => {
                      const daysUntil = getDaysUntilRenewal(sub.nextBillingDate, sub.billingCycle, sub.customMonths);
                      return (
                        <TableRow key={sub.id} data-testid={`row-subscription-${sub.id}`}>
                          <TableCell className="font-medium">{sub.serviceName}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {sub.categoryId ? categoryMap.get(sub.categoryId) || "-" : "-"}
                          </TableCell>
                          <TableCell>
                            {formatMoney(parseFloat(sub.cost))}
                          </TableCell>
                          <TableCell className="capitalize">
                            {sub.billingCycle === "custom" 
                              ? `Every ${sub.customMonths} mo` 
                              : sub.billingCycle
                            }
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{format(parseISO(getNextBillingDateFromToday(sub.nextBillingDate, sub.billingCycle, sub.customMonths)), "MMM d, yyyy")}</span>
                              {sub.status !== "cancelled" && (
                                <span className={`text-xs ${daysUntil <= 7 ? "text-chart-5" : "text-muted-foreground"}`}>
                                  {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `in ${daysUntil} days`}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(sub.status)}>
                              {sub.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(sub)}
                                data-testid={`button-edit-${sub.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(sub)}
                                data-testid={`button-delete-${sub.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <SubscriptionDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        subscription={editingSubscription}
        categories={categories}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => deletingSubscription && deleteMutation.mutate(deletingSubscription.id)}
        title="Delete Subscription"
        description={`Are you sure you want to delete "${deletingSubscription?.serviceName}"? This action cannot be undone.`}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
