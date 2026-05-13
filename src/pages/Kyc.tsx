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

  const kycDob = searchParams.get("dob");

  const computeAge = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
    return age;
  };
  const age = computeAge(kycDob);
  const underage = age !== null && age < 16;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (underage) {
      toast({ title: "Age requirement not met", description: "You must be at least 16 years old to create an account", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          password,
          phone,
          kycVerified: true,
          kycData: {
            name: searchParams.get("name"),
            dob: searchParams.get("dob"),
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
                    <Label htmlFor="name">Name (Display Name)</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="bg-background/50" />
                    <p className="text-xs text-muted-foreground">This is your nickname shown on bookings — not your legal name</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-background/50" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="bg-background/50" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 91234567" className="bg-background/50" />
                  </div>
                  {underage && (
                    <p className="text-xs text-destructive">You must be at least 16 years old to create an account.</p>
                  )}
                  <Button type="submit" className="w-full h-11 text-sm font-semibold tracking-wide uppercase" disabled={loading || underage}>
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
