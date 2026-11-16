import { Instagram, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUSINESS } from "@/seo/site";

/**
 * "Enjoyed your game? Leave us a Google review" — shown after a booking is
 * confirmed and on the receipt when a walk-in session ends. Opens Envo's
 * Google review page in a new tab (BUSINESS.googleReviewUrl), with a link to
 * Envo's Instagram below it.
 */
export function GoogleReviewPrompt({ message = "Enjoying Envo Pool? A quick Google review helps us a lot." }: { message?: string }) {
  return (
    <div className="rounded-lg border border-accent/40 bg-gradient-to-b from-accent/15 to-accent/5 p-4 text-center space-y-3">
      <div className="flex justify-center gap-1 text-accent" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
      </div>
      <p className="text-sm text-foreground">{message}</p>
      <Button asChild className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
        <a href={BUSINESS.googleReviewUrl} target="_blank" rel="noopener noreferrer"><Star className="h-4 w-4 mr-2 fill-current" />Leave a Google review</a>
      </Button>
      {/* Instagram's own colours, so it's recognisable at a glance */}
      <Button asChild className="w-full text-white font-semibold border-0 bg-gradient-to-r from-[#833AB4] via-[#E1306C] to-[#F77737] hover:opacity-90">
        <a href={BUSINESS.instagramUrl} target="_blank" rel="noopener noreferrer"><Instagram className="h-4 w-4 mr-2" />Follow us on Instagram</a>
      </Button>
    </div>
  );
}
