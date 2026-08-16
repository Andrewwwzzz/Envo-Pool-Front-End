import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, BASE_URL } from "@/lib/api";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [singpassLoading, setSingpassLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, setAuth } = useAuth();

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const handleSingpass = async () => {
    setSingpassLoading(true);
    try {
      localStorage.setItem("pendingSignup", "true");
      const res = await fetch(`${BASE_URL}/api/myinfo/auth-url-public`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok || !data.authorizeUrl) {
        throw new Error(data.error || "Failed to start Singpass verification");
      }
      window.location.href = data.authorizeUrl;
    } catch (err: any) {
      toast({ title: "Singpass error", description: err.message, variant: "destructive" });
      setSingpassLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }
      setAuth(data.token, data.user);
      toast({ title: "Login successful" });
      navigate("/booking");
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
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

        {!isLogin ? (
          <div className="space-y-4">
            <div className="text-center mb-2">
              <h2 className="text-2xl tracking-tight font-bold text-slate-400">Join Us</h2>
              <p className="text-sm text-muted-foreground mt-1">Verify your identity to create an account</p>
            </div>

            {/* Singpass — the only self-service signup path */}
            <Card className="card-premium backdrop-blur-sm relative border-accent/40">
              <div className="absolute -top-2 right-4">
                <Badge className="bg-green-600 hover:bg-green-600 text-white border-transparent">Recommended</Badge>
              </div>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-md bg-[#E3002B]/10 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-[#E3002B]" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Verify with Singpass</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <CardDescription>
                  Instant identity verification using your Singpass account.
                </CardDescription>
                <Button
                  onClick={handleSingpass}
                  disabled={singpassLoading}
                  className="w-full h-11 text-sm font-semibold tracking-wide uppercase text-white hover:opacity-90"
                  style={{ backgroundColor: "#E3002B" }}
                >
                  {singpassLoading ? "Redirecting..." : "Continue with Singpass"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">Powered by Singpass MyInfo</p>
              </CardContent>
            </Card>

            {/* No Singpass? Informational only — no self-service form */}
            <Card className="card-premium backdrop-blur-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-lg">Can't use Singpass?</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Head over to the counter and our staff will help set up your account (ID verification).
                </CardDescription>
              </CardContent>
            </Card>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <button type="button" className="text-accent hover:text-accent/80 font-medium transition-colors" onClick={() => setIsLogin(true)}>
                Sign In
              </button>
            </p>
          </div>
        ) : (
          <Card className="card-premium backdrop-blur-sm">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle className="text-2xl tracking-tight">Welcome Back</CardTitle>
              <CardDescription>Sign in to reserve your table</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-background/50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="bg-background/50" />
                </div>
                <Button type="submit" className="w-full h-11 text-sm font-semibold tracking-wide uppercase" disabled={loading}>
                  {loading ? "Loading..." : "Sign In"}
                </Button>
                <div className="text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Don't have an account?{" "}
                    <button
                      type="button"
                      className="text-accent hover:text-accent/80 font-medium transition-colors"
                      onClick={() => { setIsLogin(false); setEmail(""); setPassword(""); }}
                    >
                      Sign Up
                    </button>
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Auth;
