import { useEffect, useState } from "react";
import { useActiveCampaign } from "@/hooks/useCampaign";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

// Shows once per login session (uses sessionStorage so it doesn't repeat on tab change)
export function CampaignPopup() {
  const { data: campaign } = useActiveCampaign();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!campaign) return;
    const key = `campaign_seen_${campaign._id}`;
    if (!sessionStorage.getItem(key)) {
      setOpen(true);
      sessionStorage.setItem(key, "1");
    }
  }, [campaign]);

  if (!campaign) return null;

  const hasImage = !!(campaign.imageData || campaign.imageUrl);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="overflow-y-auto max-h-[85vh]">
          {hasImage && (
            <img
              src={(campaign.imageData || campaign.imageUrl) as string}
              alt=""
              className="w-full object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}

          {(campaign.title || campaign.body) && (
            <div className="px-5 pt-4 pb-2 space-y-2">
              {campaign.title && (
                <p className="gold-gradient text-xl font-semibold">{campaign.title}</p>
              )}
              {campaign.body && (
                <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                  {campaign.body}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 px-5 py-3">
            {campaign.buttonLabel && campaign.buttonUrl && (
              <a href={campaign.buttonUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
                  {campaign.buttonLabel}
                </Button>
              </a>
            )}
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              <X className="mr-1 h-3 w-3" /> Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
