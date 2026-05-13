import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";

const Kyc = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setAuth } = useAuth();

  const status = searchParams.get("status");
  const error = searchParams.get("error");
  const verifiedName = searchParams.get("name") || "";

  const [name, setName] = useState(verifiedName);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setName(verifiedName);
  }, [verifiedName]);

  useEffect(() => {
    if (status === "success" || error) {
      localStorage.removeItem("pendingSignup");
    }
  }, [status, error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: verifiedName,
          email,
          password,
          kycVerified: true,
          kycData: {
            name: searchParams.get("name"),
            dob: searchParams.get("dob"),
            mobile: searchParams.get("mobile"),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }
      if (data.token && data.user) {
        setAuth(data.token, data.user);
        toast({ title: "Account created", description: "Welcome aboard!" });
        navigate("/dashboard", { replace: true });
      } else {
        toast({ title: "Account created", description: "Please sign in to continue." });
        navigate("/auth", { replace: true });
      }
    } catch (err: any) {
      toast({ title: "Signup failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const isError = !!error || (status && status !== "success");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 dark">
      <div className="fixed inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight gold-gradient">Envo Pool</h1>
          <p className="text-muted-foreground mt-2 text-sm tracking-widest uppercase">Premium Pool Experience</p>
        </div>

        <Card className="card-premium backdrop-blur-sm">
          {isError ? (
            <>
              <CardHeader className="text-center space-y-3">
                <div className="mx-auto h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
                <CardTitle className="text-2xl">Verification failed</CardTitle>
                <CardDescription>Please try again.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => navigate("/auth")} className="w-full h-11 text-sm font-semibold tracking-wide uppercase">
                  Back to Sign Up
                </Button>
              </CardContent>
            </>
          ) : status === "success" ? (
            <>
              <CardHeader className="text-center space-y-3">
                <div className="mx-auto h-14 w-14 rounded-full bg-green-600/10 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle className="text-2xl">Identity Verified!</CardTitle>
                {verifiedName && (
                  <CardDescription>Welcome, {verifiedName}</CardDescription>
                )}
                <CardDescription>Finish creating your account below.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-background/50" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="bg-background/50" />
                  </div>
                  <Button type="submit" className="w-full h-11 text-sm font-semibold tracking-wide uppercase" disabled={loading}>
                    {loading ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Processing...</CardTitle>
                <CardDescription>Waiting for verification result.</CardDescription>
              </CardHeader>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Kyc;
