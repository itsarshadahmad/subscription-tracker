import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Calendar, CreditCard, Clock } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from "date-fns";

interface CalendarEvent {
  id: string;
  date: string;
  serviceName: string;
  cost: string;
  type: "billing" | "trial_end";
}

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar", year, month],
    queryFn: async () => {
      const res = await fetch(`/api/calendar?year=${year}&month=${month}`);
      if (!res.ok) throw new Error("Failed to fetch calendar");
      return res.json();
    },
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startPadding = monthStart.getDay();
  const paddedDays = [
    ...Array(startPadding).fill(null),
    ...days,
  ];

  const getEventsForDay = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    return events.filter(e => e.date === dateStr);
  };

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  const monthTotal = events
    .filter(e => e.type === "billing")
    .reduce((sum, e) => sum + parseFloat(e.cost), 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Billing Calendar
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevMonth} data-testid="button-prev-month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleToday} data-testid="button-today">
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={handleNextMonth} data-testid="button-next-month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-lg font-semibold">{format(currentDate, "MMMM yyyy")}</span>
          <span className="text-sm text-muted-foreground">
            Month total: <span className="font-medium text-foreground">{formatCurrency(monthTotal)}</span>
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
            <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground bg-background">
              {day}
            </div>
          ))}
          {paddedDays.map((day, index) => {
            if (!day) {
              return <div key={`empty-${index}`} className="min-h-[80px] sm:min-h-[100px] bg-muted/30" />;
            }

            const dayEvents = getEventsForDay(day);
            const hasEvents = dayEvents.length > 0;
            const todayClass = isToday(day) ? "ring-2 ring-primary ring-inset" : "";

            return (
              <div
                key={day.toISOString()}
                className={`min-h-[80px] sm:min-h-[100px] p-1 sm:p-2 bg-background ${todayClass}`}
                data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
              >
                <div className={`text-xs sm:text-sm mb-1 ${isToday(day) ? "font-bold text-primary" : "text-muted-foreground"}`}>
                  {format(day, "d")}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map(event => (
                    <div
                      key={event.id}
                      className={`text-xs p-1 rounded truncate ${
                        event.type === "trial_end" 
                          ? "bg-chart-5/20 text-chart-5" 
                          : "bg-primary/10 text-primary"
                      }`}
                      title={`${event.serviceName}: ${formatCurrency(parseFloat(event.cost))}`}
                    >
                      <span className="hidden sm:inline">{event.serviceName}</span>
                      <span className="sm:hidden">{event.serviceName.slice(0, 3)}</span>
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-muted-foreground pl-1">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {events.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-medium">Upcoming this month</h4>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {events.map(event => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  data-testid={`event-${event.id}`}
                >
                  <div className="flex items-center gap-2">
                    {event.type === "trial_end" ? (
                      <Clock className="h-4 w-4 text-chart-5" />
                    ) : (
                      <CreditCard className="h-4 w-4 text-primary" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{event.serviceName}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.date), "MMM d")}
                        {event.type === "trial_end" && " (Trial ends)"}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-medium">{formatCurrency(parseFloat(event.cost))}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
