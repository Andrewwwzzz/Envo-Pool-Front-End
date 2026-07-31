import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { List as ListIcon, Eye, Save, Loader2, CheckCircle, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { fmtDateSG } from "@/lib/sgTime";

export default function DashboardSettings() {
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [showName, setShowName] = useState(false);
  const [nameToggleLoading, setNameToggleLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const kycVerified = !!profile?.kyc?.verified;
  const isPhoneVerified = !!profile?.isPhoneVerified;

  const [otpSent, setOtpSent] = useState(false);
  const [waLink, setWaLink] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpVerifyLoading, setOtpVerifyLoading] = useState(false);
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
    const changed =
      phone !== (profile.phone ?? "") ||
      dob !== (profile.date_of_birth ?? "");
    setHasChanges(changed);
  }, [phone, dob, profile]);

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

  const handleSendOtp = async () => {
    if (!phone.trim()) {
      toast({ title: "Please enter a phone number first", variant: "destructive" });
      return;
    }
    setOtpLoading(true);
    try {
      const res = await apiFetch("/api/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");
      setOtpSent(true);
      if (data.waLink) setWaLink(data.waLink);
      toast({ title: "Open WhatsApp to get your OTP" });
    } catch (err: any) {
      toast({ title: "Failed to send OTP", description: err.message, variant: "destructive" });
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) return;
    setOtpVerifyLoading(true);
    try {
      const res = await apiFetch("/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ otp: otp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid OTP");
      toast({ title: "✅ Phone number verified!" });
      setOtpSent(false);
      setOtp("");
      setWaLink(null);
    } catch (err: any) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    } finally {
      setOtpVerifyLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const updates: { phone?: string; date_of_birth?: string } = {};
      const trimmedPhone = phone.trim();
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
            <Label htmlFor="phone">Phone Number</Label>
            {isPhoneVerified ? (
              <div className="flex items-center gap-2">
                <Input id="phone" type="tel" value={phone} disabled className="bg-muted/50 cursor-not-allowed" />
                <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 91234567" />
                  {kycVerified && (
                    <Button type="button" variant="outline" onClick={handleSendOtp} disabled={otpLoading} className="shrink-0">
                      {otpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
                {!kycVerified && (
                  <p className="text-xs text-muted-foreground">Account must be verified before you can verify your phone number</p>
                )}
                {otpSent && (
                  <div className="space-y-2 mt-2">
                    {waLink && (
                      <a href={waLink} target="_blank" rel="noopener noreferrer" className="block w-full">
                        <Button type="button" className="w-full bg-green-600 hover:bg-green-700 text-white gap-2">
                          <MessageSquare className="h-4 w-4" />
                          Open WhatsApp to get OTP
                        </Button>
                      </a>
                    )}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        placeholder="Enter 6-digit OTP from WhatsApp"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        maxLength={6}
                      />
                      <Button type="button" onClick={handleVerifyOtp} disabled={otpVerifyLoading || otp.length !== 6} className="shrink-0 sm:w-auto w-full">
                        {otpVerifyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
            <p className="text-xs text-muted-foreground">
              {isPhoneVerified ? "Verified · WhatsApp notifications enabled" : "Verify your phone to receive WhatsApp notifications"}
            </p>
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
              <p className="text-xs text-muted-foreground mt-0.5">Others can see your legal name on booked slots (off by default)</p>
            </div>
            <Switch id="name-toggle" checked={showName} onCheckedChange={handleToggleNameVisibility} disabled={nameToggleLoading} />
          </div>
        </CardContent>
      </Card>
    </>
  );
}





