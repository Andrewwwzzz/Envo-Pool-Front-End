import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUSINESS } from "@/seo/site";

/**
 * "Enjoyed your game? Leave us a Google review" — shown after a booking is
 * confirmed and on the receipt when a walk-in session ends. Opens Envo's
 * Google review page in a new tab (BUSINESS.googleReviewUrl).
 */
export function GoogleReviewPrompt({ message = "Enjoying Envo Pool? A quick Google review helps us a lot." }: { message?: string }) {
  return (
    <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 text-center space-y-3">
      <div className="flex justify-center gap-1 text-accent" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
      </div>
      <p className="text-sm text-foreground">{message}</p>
      <Button asChild variant="outline" className="w-full border-accent/40">
        <a href={BUSINESS.googleReviewUrl} target="_blank" rel="noopener noreferrer">Leave a Google review</a>
      </Button>
    </div>
  );
}
