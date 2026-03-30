import { useTermsContent } from "@/hooks/useTerms";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const Terms = () => {
  const { data: terms, isLoading } = useTermsContent();

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
        {!terms?.content ? (
          <p className="text-muted-foreground">No terms and conditions available.</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
            {terms.content.split("\n").map((line, i) => {
              if (line.startsWith("# ")) {
                return <h1 key={i} className="text-2xl font-bold mb-4 gold-gradient">{line.slice(2)}</h1>;
              }
              const parts = line.split(/\*\*(.*?)\*\*/g);
              return (
                <p key={i} className="mb-2 text-foreground/80 leading-relaxed">
                  {parts.map((part, j) =>
                    j % 2 === 1 ? <strong key={j} className="text-foreground">{part}</strong> : part
                  )}
                </p>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Terms;
