import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Link } from "react-router-dom";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Settings as SettingsIcon, Eye, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

const Settings = () => {
  const { user, loading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [showName, setShowName] = useState(true);
  const [nameToggleLoading, setNameToggleLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const kycVerified = !!profile?.kyc?.verified;
  const kycDob = profile?.kyc?.dob ?? null;
  const kycName = profile?.kyc?.name ?? null;

  const formatDobDisplay = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) {
      // Try parsing yyyy-mm-dd manually
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
      if (m) return `${m[3]}/${m[2]}/${m[1]}`;
      return iso;
    }
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setName(kycVerified && kycName ? kycName : profile.name ?? "");
      setUsername(profile.username ?? "");
      setPhone(profile.phone ?? "");
      setDob(kycVerified && kycDob ? kycDob : profile.date_of_birth ?? "");
    }
  }, [profile, kycVerified, kycName, kycDob]);

  // Fetch name visibility preference
  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    apiFetch(`/api/bookings/name-visibility?userId=${userId}`)
      .then(res => res.ok ? res.json() : null)
      .catch(() => {});
  }, [user]);

  // Track changes
  useEffect(() => {
    if (!profile) return;
    const changed =
      name !== (profile.name ?? "") ||
      username !== (profile.username ?? "") ||
      phone !== (profile.phone ?? "") ||
      dob !== (profile.date_of_birth ?? "");
    setHasChanges(changed && !usernameError);
  }, [name, username, phone, dob, profile, usernameError]);

  const handleUsernameChange = (val: string) => {
    if (val.length > 20) return;
    setUsername(val);
    if (val && !/^[A-Za-z0-9_.]*$/.test(val)) {
      setUsernameError("Only letters, numbers, underscores and dots allowed (no spaces)");
    } else {
      setUsernameError(null);
    }
  };

  const handleToggleNameVisibility = async (checked: boolean) => {
    setShowName(checked);
    setNameToggleLoading(true);
    try {
      const res = await apiFetch("/api/bookings/toggle-name-visibility", {
        method: "POST",
        body: JSON.stringify({ userId: user.id, showName: checked }),
      });
      if (!res.ok) {
        setShowName(!checked);
        toast({ title: "Failed to update preference", variant: "destructive" });
      }
    } catch {
      setShowName(!checked);
      toast({ title: "Failed to update preference", variant: "destructive" });
    } finally {
      setNameToggleLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      await updateProfile.mutateAsync({
        name: name.trim(),
        phone: phone.trim(),
        date_of_birth: dob || undefined,
      });
      toast({ title: "Profile updated successfully" });
    } catch (err: any) {
      toast({ title: "Failed to update profile", description: err.message, variant: "destructive" });
    }
  };

  if (loading || profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground dark">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background dark">
      <div className="fixed inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      <header className="relative z-10 border-b border-border/50 bg-card/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/dashboard">
            <Button variant="outline" size="sm" className="border-accent text-accent hover:bg-accent hover:text-accent-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
            </Button>
          </Link>
          <h1 className="text-xl font-bold tracking-tight gold-gradient">Settings</h1>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-2xl p-6 space-y-6">
        {/* Account Details */}
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <SettingsIcon className="h-5 w-5 text-accent" />
              Account Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={profile?.email ?? ""}
                disabled
                className="bg-muted/50 cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                disabled={kycVerified}
                className={kycVerified ? "bg-muted/50 cursor-not-allowed" : undefined}
              />
              {kycVerified && (
                <p className="text-xs text-muted-foreground">Verified via Singpass · Cannot be changed</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 91234567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth</Label>
              {kycVerified ? (
                <>
                  <Input
                    id="dob"
                    type="text"
                    value={formatDobDisplay(dob)}
                    disabled
                    className="bg-muted/50 cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground">Verified via Singpass · Cannot be changed</p>
                </>
              ) : (
                <Input
                  id="dob"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                />
              )}
            </div>

            <Button
              onClick={handleSaveProfile}
              disabled={!hasChanges || updateProfile.isPending}
              className="w-full"
            >
              {updateProfile.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Privacy Settings */}
        <Card className="card-premium">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="h-5 w-5 text-accent" />
              Privacy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="name-toggle" className="font-medium cursor-pointer">Show my name on bookings</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Other users can see your name on booked slots</p>
              </div>
              <Switch
                id="name-toggle"
                checked={showName}
                onCheckedChange={handleToggleNameVisibility}
                disabled={nameToggleLoading}
              />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings;
