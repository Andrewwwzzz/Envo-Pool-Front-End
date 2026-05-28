import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { List as ListIcon, Eye, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { fmtDateSG } from "@/lib/sgTime";

export default function DashboardSettings() {
  const { user } = useAuth();
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
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
      if (m) return `${m[3]}/${m[2]}/${m[1]}`;
      return iso;
    }
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  useEffect(() => {
    if (profile) {
      setName(kycName ?? "");
      setUsername(profile.username ?? profile.name ?? "");
      setPhone(profile.phone ?? "");
      setDob(kycVerified && kycDob ? kycDob : profile.date_of_birth ?? "");
    }
  }, [profile, kycVerified, kycName, kycDob]);

  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    apiFetch(`/api/bookings/name-visibility?userId=${userId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && typeof data.showName === "boolean") setShowName(data.showName);
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!profile) return;
    const currentUsername = profile.username ?? profile.name ?? "";
    const changed =
      username !== currentUsername ||
      phone !== (profile.phone ?? "") ||
      dob !== (profile.date_of_birth ?? "");
    setHasChanges(changed && !usernameError);
  }, [username, phone, dob, profile, usernameError]);

  const handleUsernameChange = (val: string) => {
    if (val.length > 20) return;
    setUsername(val);
    if (val && !/^[A-Za-z0-9_. ]*$/.test(val)) {
      setUsernameError("Only letters, numbers, spaces, underscores and dots allowed");
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
        body: JSON.stringify({ userId: user!.id, showName: checked }),
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
    if (usernameError) return;
    try {
      const updates: { username?: string; phone?: string; date_of_birth?: string } = {};
      const trimmedUsername = username.trim();
      const trimmedPhone = phone.trim();
      if (trimmedUsername !== (profile?.username ?? profile?.name ?? "")) updates.username = trimmedUsername;
      if (trimmedPhone !== (profile?.phone ?? "")) updates.phone = trimmedPhone;
      if (dob && dob !== (profile?.date_of_birth ?? "")) updates.date_of_birth = dob;
      if (Object.keys(updates).length === 0) { toast({ title: "No changes to save" }); return; }
      await updateProfile.mutateAsync(updates);
      toast({ title: "Profile updated successfully" });
    } catch (err: any) {
      toast({ title: "Failed to update profile", description: err.message, variant: "destructive" });
    }
  };

  if (profileLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <>
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ListIcon className="h-[20px] w-[20px] text-accent" />
            Account Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={profile?.email ?? ""} disabled className="bg-muted/50 cursor-not-allowed" />
            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
          </div>

          {(profile?.createdAt || profile?.created_at) && (
            <div className="space-y-2">
              <Label htmlFor="created">Member Since</Label>
              <Input id="created" value={fmtDateSG(profile.createdAt ?? profile.created_at)} disabled className="bg-muted/50 cursor-not-allowed" />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Legal Name</Label>
            <Input id="name" value={name} placeholder="Set by staff or Singpass verification" disabled className="bg-muted/50 cursor-not-allowed" />
            <p className="text-xs text-muted-foreground">
              {kycVerified ? "Verified · Cannot be changed" : "Your legal name is set by staff during verification or via Singpass"}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="username">Username</Label>
              <span className="text-xs text-muted-foreground">{username.length}/20</span>
            </div>
            <Input id="username" value={username} onChange={(e) => handleUsernameChange(e.target.value)} placeholder="Optional" maxLength={20} />
            {usernameError ? (
              <p className="text-xs text-destructive">{usernameError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Your username is shown on bookings instead of your real name</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 91234567" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dob">Date of Birth</Label>
            {kycVerified ? (
              <>
                <Input id="dob" type="text" value={formatDobDisplay(dob)} disabled className="bg-muted/50 cursor-not-allowed" />
                <p className="text-xs text-muted-foreground">Verified · Cannot be changed</p>
              </>
            ) : (
              <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            )}
          </div>

          <Button onClick={handleSaveProfile} disabled={!hasChanges || updateProfile.isPending} className="w-full">
            {updateProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </CardContent>
      </Card>

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
              <Label htmlFor="name-toggle" className="font-medium cursor-pointer">Show name on bookings</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Others can see your username (or display name if no username set) on booked slots</p>
            </div>
            <Switch id="name-toggle" checked={showName} onCheckedChange={handleToggleNameVisibility} disabled={nameToggleLoading} />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
