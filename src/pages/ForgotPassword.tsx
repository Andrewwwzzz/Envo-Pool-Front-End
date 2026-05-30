import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
    } catch (err) {
      // Intentionally swallow — always show the same message
      console.error("forgot-password error:", err);
    } finally {
      setSent(true);
      setLoading(false);
      toast({
        title: "Check your email",
        description: "If that email is registered, a reset link has been sent.",
      });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 dark">
      <div className="fixed inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight gold-gradient">Envo Pool</h1>
          <p className="text-muted-foreground mt-2 text-sm tracking-widest uppercase">Premium Pool Experience</p>
        </div>
        <Card className="card-premium backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-4">
            <Link to="/auth" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1">
              <ArrowLeft className="h-3 w-3" /> Back to sign in
            </Link>
            <CardTitle className="text-2xl tracking-tight">Forgot Password</CardTitle>
            <CardDescription>
              Enter your email and we'll send you a reset link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-background/50"
                />
              </div>
              <Button type="submit" className="w-full h-11 text-sm font-semibold tracking-wide uppercase" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
              {sent && (
                <p className="text-sm text-muted-foreground text-center">
                  If that email is registered, a reset link has been sent.
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword;
