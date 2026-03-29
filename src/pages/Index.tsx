import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Target, Cpu, Trophy, Users, ArrowRight, ChevronDown, Star, Zap } from "lucide-react";
import heroImage from "@/assets/hero-pool.jpg";
import poolBalls from "@/assets/pool-balls.jpg";
import poolTech from "@/assets/pool-tech.jpg";

const Index = () => {
  return (
    <div className="min-h-screen bg-background dark">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight gold-gradient">Envo Pool</h1>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="outline" size="sm" className="border-accent text-accent hover:bg-accent hover:text-accent-foreground">
                Sign In
              </Button>
            </Link>
            <Link to="/booking">
              <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
                Book Now
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImage} alt="Premium pool hall interior with competition-grade tables" className="w-full h-full object-cover" loading="eager" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/60 to-transparent" />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl px-6 text-center pt-20">
          <p className="text-accent uppercase tracking-[0.3em] text-sm font-medium mb-6">Singapore's Premium Pool Experience</p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.9] mb-8">
            <span className="gold-gradient">Elevate</span>
            <br />
            <span className="text-foreground">Your Game</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Competition-grade tables. Tournament-quality balls. A space built for players who take their craft seriously — from first break to championship run.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/booking">
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 px-8 text-base">
                Reserve a Table <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <a href="#about">
              <Button size="lg" variant="outline" className="border-accent/30 text-accent hover:bg-accent/10 px-8 text-base">
                Learn More
              </Button>
            </a>
          </div>
        </div>

        <a href="#about" className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <ChevronDown className="h-6 w-6 text-accent/60" />
        </a>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-accent uppercase tracking-[0.2em] text-xs font-medium mb-4">Why Anytime Pool</p>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
                <span className="gold-gradient">Redefining</span>{" "}
                <span className="text-foreground">Pool Culture in Singapore</span>
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                We're not your average pool hall. Anytime Pool is a modern, tech-integrated space designed for serious players. Every detail — from our competition-grade Rasson tables to our Aramith balls — is chosen to deliver a professional playing experience.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Whether you're perfecting your break, training for tournaments, or simply want to play on equipment that matches your ambition, this is your space.
              </p>
            </div>
            <div className="relative">
              <img src={poolBalls} alt="Competition-grade billiard balls on premium felt" className="rounded-2xl w-full object-cover aspect-square" loading="lazy" />
              <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-accent/10" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 md:py-32 border-t border-border/30">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <p className="text-accent uppercase tracking-[0.2em] text-xs font-medium mb-4">The Anytime Difference</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              <span className="gold-gradient">Built for</span>{" "}
              <span className="text-foreground">Performance</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Target,
                title: "Competition-Grade Tables",
                desc: "Professional Rasson tables with tournament-spec cushions and premium cloth for a true competition feel.",
              },
              {
                icon: Star,
                title: "Premium Equipment",
                desc: "Aramith balls, high-quality house cues, and everything you need to play at the highest level.",
              },
              {
                icon: Cpu,
                title: "Tech-Integrated",
                desc: "Seamless online booking, digital timers, and smart table management — pool halls, modernized.",
              },
              {
                icon: Zap,
                title: "Open Anytime",
                desc: "Flexible hours designed around your schedule. Practice when inspiration strikes, not when we say so.",
              },
            ].map((f, i) => (
              <div key={i} className="card-premium rounded-2xl p-8 group hover:border-accent/20 transition-all duration-300">
                <f.icon className="h-8 w-8 text-accent mb-5" />
                <h3 className="text-lg font-semibold text-foreground mb-3 font-sans">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Player Tiers */}
      <section className="py-24 md:py-32 border-t border-border/30">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <p className="text-accent uppercase tracking-[0.2em] text-xs font-medium mb-4">For Every Level</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              <span className="gold-gradient">Your Journey,</span>{" "}
              <span className="text-foreground">Our Space</span>
            </h2>
            <p className="text-muted-foreground mt-4 max-w-xl mx-auto">
              Whether you just picked up a cue or you're eyeing the tournament circuit, Anytime Pool is built for your growth.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                tier: "Learner",
                icon: Users,
                tagline: "Start strong",
                points: [
                  "Play on real competition tables from day one",
                  "Learn proper technique on professional equipment",
                  "Comfortable, no-pressure environment",
                  "Affordable hourly rates to build your skills",
                ],
              },
              {
                tier: "Intermediate",
                icon: Trophy,
                tagline: "Level up",
                points: [
                  "Refine your game on tournament-grade setups",
                  "Practice drills with consistent ball response",
                  "Book tables during off-peak for focused sessions",
                  "Track your spending and sessions via your dashboard",
                ],
                featured: true,
              },
              {
                tier: "Professional",
                icon: Target,
                tagline: "Compete at the top",
                points: [
                  "Train on the same equipment used in competitions",
                  "Extended session bookings for serious practice",
                  "Priority table access for regulars",
                  "A space that respects your dedication to the craft",
                ],
              },
            ].map((t, i) => (
              <div
                key={i}
                className={`card-premium rounded-2xl p-8 relative ${t.featured ? "border-accent/30 ring-1 ring-accent/10" : ""}`}
              >
                {t.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-accent text-accent-foreground text-xs font-semibold px-4 py-1 rounded-full uppercase tracking-wider">
                      Most Popular
                    </span>
                  </div>
                )}
                <t.icon className="h-8 w-8 text-accent mb-4" />
                <h3 className="text-2xl font-bold text-foreground mb-1 font-sans">{t.tier}</h3>
                <p className="text-accent text-sm font-medium mb-6 uppercase tracking-wider">{t.tagline}</p>
                <ul className="space-y-3">
                  {t.points.map((p, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Section */}
      <section className="py-24 md:py-32 border-t border-border/30">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="relative order-2 md:order-1">
              <img src={poolTech} alt="Technology-integrated modern pool hall" className="rounded-2xl w-full object-cover aspect-square" loading="lazy" />
              <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-accent/10" />
            </div>
            <div className="order-1 md:order-2">
              <p className="text-accent uppercase tracking-[0.2em] text-xs font-medium mb-4">Innovation Meets Tradition</p>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
                <span className="gold-gradient">Pool,</span>{" "}
                <span className="text-foreground">Modernized</span>
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                We're bringing Singapore's pool scene into the future. Our tech-first approach means seamless online booking, real-time table availability, digital wallet and rewards — all so you can focus on what matters: your game.
              </p>
              <ul className="space-y-4">
                {["Instant online table reservations", "Real-time availability tracking", "Digital wallet & reward points", "Transparent dynamic pricing"].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-foreground">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10">
                      <Zap className="h-3 w-3 text-accent" />
                    </span>
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 md:py-32 border-t border-border/30">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            <span className="gold-gradient">Ready to Play?</span>
          </h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto">
            Book your table in seconds. No calls, no waiting — just walk in and play on the best equipment in Singapore.
          </p>
          <Link to="/booking">
            <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 px-10 text-base">
              Reserve Your Table <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 py-12">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="gold-gradient text-lg font-bold">Anytime Pool</p>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms & Conditions</Link>
            <Link to="/auth" className="hover:text-foreground transition-colors">Sign In</Link>
            <Link to="/booking" className="hover:text-foreground transition-colors">Book Now</Link>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Anytime Pool. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
