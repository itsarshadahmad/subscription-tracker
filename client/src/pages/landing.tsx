import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { CreditCard, Bell, PieChart, Shield, ArrowRight, Check } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <CreditCard className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">SubTrack</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild data-testid="button-login-nav">
              <a href="/api/login">Sign In</a>
            </Button>
          </div>
        </div>
      </nav>

      <main className="pt-16">
        <section className="relative overflow-hidden py-20 lg:py-32">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-chart-2/5" />
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="font-serif text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Take Control of Your{" "}
                <span className="text-primary">Subscriptions</span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
                Track all your recurring payments in one place. See exactly where your money goes, 
                get reminded before renewals, and never pay for forgotten subscriptions again.
              </p>
              <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Button size="lg" asChild data-testid="button-get-started">
                  <a href="/api/login" className="gap-2">
                    Get Started Free
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-chart-3" />
                  <span>Free forever</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-chart-3" />
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-chart-3" />
                  <span>Secure & private</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 bg-card/50">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-serif text-3xl font-bold sm:text-4xl">
                Everything you need to manage subscriptions
              </h2>
              <p className="mt-4 text-muted-foreground">
                Simple, powerful tools to help you understand and control your recurring expenses
              </p>
            </div>
            <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="hover-elevate">
                <CardContent className="pt-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-chart-1/10">
                    <PieChart className="h-6 w-6 text-chart-1" />
                  </div>
                  <h3 className="mt-4 font-semibold">Spending Overview</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    See your total monthly and yearly subscription costs at a glance
                  </p>
                </CardContent>
              </Card>
              <Card className="hover-elevate">
                <CardContent className="pt-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-chart-2/10">
                    <Bell className="h-6 w-6 text-chart-2" />
                  </div>
                  <h3 className="mt-4 font-semibold">Renewal Reminders</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Get notified before subscriptions renew so you're never surprised
                  </p>
                </CardContent>
              </Card>
              <Card className="hover-elevate">
                <CardContent className="pt-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-chart-3/10">
                    <CreditCard className="h-6 w-6 text-chart-3" />
                  </div>
                  <h3 className="mt-4 font-semibold">Track Trials</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Monitor free trials and cancel before they convert to paid plans
                  </p>
                </CardContent>
              </Card>
              <Card className="hover-elevate">
                <CardContent className="pt-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-chart-4/10">
                    <Shield className="h-6 w-6 text-chart-4" />
                  </div>
                  <h3 className="mt-4 font-semibold">Secure & Private</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Your data stays private. We never store payment information
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-xl text-center">
              <h2 className="font-serif text-3xl font-bold">
                Ready to take control?
              </h2>
              <p className="mt-4 text-muted-foreground">
                Join thousands of users who have simplified their subscription management
              </p>
              <Button size="lg" className="mt-8" asChild data-testid="button-cta-bottom">
                <a href="/api/login" className="gap-2">
                  Start Tracking Now
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} SubTrack. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
