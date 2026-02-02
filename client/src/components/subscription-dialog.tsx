import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import type { Subscription, Category } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/auth-utils";

const formSchema = z.object({
  serviceName: z.string().min(1, "Service name is required"),
  categoryId: z.string().optional(),
  cost: z.string().min(1, "Cost is required").refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, "Must be a valid positive number"),
  billingCycle: z.enum(["monthly", "yearly", "custom"]),
  customMonths: z.number().min(1).optional().nullable(),
  nextBillingDate: z.date({ required_error: "Next billing date is required" }),
  status: z.enum(["active", "trial", "cancelled"]),
  trialEndDate: z.date().optional().nullable(),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
  reminderDays: z.number().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

interface SubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: Subscription | null;
  categories: Category[];
}

export function SubscriptionDialog({ open, onOpenChange, subscription, categories }: SubscriptionDialogProps) {
  const { toast } = useToast();
  const isEditing = !!subscription;
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const categoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", "/api/categories", { name });
      return response.json();
    },
    onSuccess: (newCategory: Category) => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      form.setValue("categoryId", newCategory.id);
      setShowNewCategory(false);
      setNewCategoryName("");
      toast({ title: "Category created" });
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

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      serviceName: "",
      categoryId: undefined,
      cost: "",
      billingCycle: "monthly",
      customMonths: null,
      nextBillingDate: new Date(),
      status: "active",
      trialEndDate: null,
      paymentMethod: "",
      notes: "",
      reminderDays: null,
    },
  });

  useEffect(() => {
    if (open && subscription) {
      form.reset({
        serviceName: subscription.serviceName,
        categoryId: subscription.categoryId || undefined,
        cost: subscription.cost,
        billingCycle: subscription.billingCycle,
        customMonths: subscription.customMonths,
        nextBillingDate: parseISO(subscription.nextBillingDate),
        status: subscription.status,
        trialEndDate: subscription.trialEndDate ? parseISO(subscription.trialEndDate) : null,
        paymentMethod: subscription.paymentMethod || "",
        notes: subscription.notes || "",
        reminderDays: subscription.reminderDays,
      });
    } else if (open) {
      form.reset({
        serviceName: "",
        categoryId: undefined,
        cost: "",
        billingCycle: "monthly",
        customMonths: null,
        nextBillingDate: new Date(),
        status: "active",
        trialEndDate: null,
        paymentMethod: "",
        notes: "",
        reminderDays: null,
      });
    }
    setShowNewCategory(false);
    setNewCategoryName("");
  }, [open, subscription, form]);

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload = {
        ...data,
        nextBillingDate: format(data.nextBillingDate, "yyyy-MM-dd"),
        trialEndDate: data.trialEndDate ? format(data.trialEndDate, "yyyy-MM-dd") : null,
        categoryId: data.categoryId || null,
      };

      if (isEditing) {
        await apiRequest("PATCH", `/api/subscriptions/${subscription.id}`, payload);
      } else {
        await apiRequest("POST", "/api/subscriptions", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions"] });
      toast({ title: isEditing ? "Subscription updated" : "Subscription created" });
      onOpenChange(false);
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

  const billingCycle = form.watch("billingCycle");
  const status = form.watch("status");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl">{isEditing ? "Edit Subscription" : "Add Subscription"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="serviceName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Netflix, Spotify" {...field} data-testid="input-service-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  {showNewCategory ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="New category name"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        className="flex-1"
                        data-testid="input-new-category"
                      />
                      <Button
                        type="button"
                        size="default"
                        onClick={() => {
                          if (newCategoryName.trim()) {
                            categoryMutation.mutate(newCategoryName.trim());
                          }
                        }}
                        disabled={categoryMutation.isPending || !newCategoryName.trim()}
                        data-testid="button-save-category"
                      >
                        {categoryMutation.isPending ? "..." : "Add"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setShowNewCategory(false);
                          setNewCategoryName("");
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-category" className="flex-1">
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setShowNewCategory(true)}
                        data-testid="button-add-category"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="9.99" {...field} data-testid="input-cost" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="billingCycle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billing Cycle</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-billing-cycle">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {billingCycle === "custom" && (
              <FormField
                control={form.control}
                name="customMonths"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Every X Months</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        placeholder="e.g. 3"
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                        data-testid="input-custom-months"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nextBillingDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Next Billing Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            data-testid="button-next-billing-date"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                            <span className="truncate">{field.value ? format(field.value, "MMM d, yyyy") : "Pick a date"}</span>
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="trial">Trial</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {status === "trial" && (
              <FormField
                control={form.control}
                name="trialEndDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Trial End Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            data-testid="button-trial-end-date"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                            <span className="truncate">{field.value ? format(field.value, "MMM d, yyyy") : "Pick a date"}</span>
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="reminderDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reminder</FormLabel>
                  <Select 
                    onValueChange={(val) => field.onChange(val === "none" ? null : parseInt(val))} 
                    value={field.value?.toString() || "none"}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-reminder">
                        <SelectValue placeholder="No reminder" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No reminder</SelectItem>
                      <SelectItem value="1">1 day before</SelectItem>
                      <SelectItem value="3">3 days before</SelectItem>
                      <SelectItem value="7">7 days before</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Visa ending in 1234" {...field} data-testid="input-payment-method" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Any additional notes..." className="min-h-[80px]" {...field} data-testid="input-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending} className="w-full sm:w-auto" data-testid="button-save-subscription">
                {mutation.isPending ? "Saving..." : (isEditing ? "Update" : "Add Subscription")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
