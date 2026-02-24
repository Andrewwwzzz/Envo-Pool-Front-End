import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import singpassBtn from "@/assets/singpass-btn.png";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate("/booking");
  }, [user, navigate]);

  const calculateAge = (dateOfBirth: string): number => {
    const today = new Date();
    const birth = new Date(dateOfBirth);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Login failed", description: error.message, variant: "destructive" });
      } else {
        navigate("/booking");
      }
    } else {
      if (!dob) {
        toast({ title: "Date of birth required", description: "Please enter your date of birth for age verification.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const age = calculateAge(dob);
      if (age < 16) {
        toast({ title: "Age restriction", description: "You must be at least 16 years old to create an account.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, phone, date_of_birth: dob },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        toast({ title: "Signup failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Check your email", description: "We sent you a confirmation link." });
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 dark">
      {/* Subtle background pattern */}
      <div className="fixed inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight gold-gradient">Anytime Pool</h1>
          <p className="text-muted-foreground mt-2 text-sm tracking-widest uppercase">Premium Pool Experience</p>
        </div>

        <Card className="card-premium backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl tracking-tight">{isLogin ? "Welcome Back" : "Join Us"}</CardTitle>
            <CardDescription>
              {isLogin ? "Sign in to reserve your table" : "Create an account to get started"}
            </CardDescription>
            {!isLogin && (
              <div className="mt-3 rounded-lg bg-accent/10 border border-accent/20 p-3">
                <p className="text-xs text-muted-foreground">
                  🔐 <strong>Singpass verification</strong> will be required for booking. For now, age verification is done via date of birth (minimum age: 16).
                </p>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="bg-background/50" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone (optional)</Label>
                    <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-background/50" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} required className="bg-background/50" />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-background/50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="bg-background/50" />
              </div>
              <Button type="submit" className="w-full h-11 text-sm font-semibold tracking-wide uppercase" disabled={loading}>
                {loading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
              </Button>
              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
                  <button type="button" className="text-accent hover:text-accent/80 font-medium transition-colors" onClick={() => setIsLogin(!isLogin)}>
                    {isLogin ? "Sign Up with Singpass" : "Sign In"}
                  </button>
                </p>
                {isLogin && (
                  <div className="flex justify-center">
                    <img src={singpassBtn} alt="Retrieve Myinfo with Singpass" className="h-10 rounded-lg cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setIsLogin(false)} />
                  </div>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
