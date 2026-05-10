import { useTermsContent } from "@/hooks/useTerms";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const fmtDate = (d?: string) => {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      timeZone: "Asia/Singapore",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return d;
  }
};

const Terms = () => {
  const { data: terms, isLoading, isError } = useTermsContent();
  const t = terms as any;
  const sections: Array<{ heading: string; content: string }> = Array.isArray(t?.sections) ? t.sections : [];
  const title: string = t?.title || "Terms & Conditions";
  const lastUpdated: string | undefined = t?.lastUpdated || t?.updated_at || t?.updatedAt;

  return (
    <div className="min-h-screen bg-background dark">
      <div className="fixed inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)', backgroundSize: '40px 40px' }} />

      <header className="relative z-10 border-b border-border/50 bg-card/80 backdrop-blur-md px-6 py-4 flex items-center gap-3">
        <Link to="/booking">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        </Link>
        <h1 className="text-xl font-bold tracking-tight gold-gradient">Terms & Conditions</h1>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl p-6">
        {isLoading && !terms ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : isError ? (
          <p className="text-muted-foreground">Unable to load terms. Please try again later.</p>
        ) : sections.length === 0 && !t?.content ? (
          <p className="text-muted-foreground">No terms and conditions available.</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <h1 className="text-2xl font-bold mb-2 gold-gradient">{title}</h1>
            {lastUpdated && (
              <p className="text-sm text-muted-foreground mb-6">Last updated: {fmtDate(lastUpdated)}</p>
            )}
            {sections.length > 0 ? (
              sections.map((s, i) => (
                <section key={i} className="mb-5">
                  <h2 className="font-bold text-foreground mb-2">{s.heading}</h2>
                  <p className="text-foreground/80 leading-relaxed whitespace-pre-wrap">{s.content}</p>
                </section>
              ))
            ) : (
              <div className="whitespace-pre-wrap text-foreground/80 leading-relaxed">{t?.content}</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Terms;
