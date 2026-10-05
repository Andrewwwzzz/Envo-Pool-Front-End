import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Target, Cpu, Trophy, ArrowRight, ChevronDown, Star } from "lucide-react";
import poolBalls from "@/assets/pool-balls-720.webp";
import poolTech from "@/assets/pool-tech-720.webp";
import entrance640 from "@/assets/envo-entrance-640.webp";
import entrance1200 from "@/assets/envo-entrance-1200.webp";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { BUSINESS, FAQ, HERO_IMAGE, HOURS_SHORT, OPENING_HOURS } from "@/seo/site";

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const handleBookNow = () => {
    if (!user) { navigate("/auth"); return; }
    if (!user.kyc?.verified) {
      toast({ title: "Please verify your identity via Singpass before booking" });
      navigate("/dashboard"); return;
    }
    navigate("/booking");
  };

  const handleInstallApp = () => {
    alert("On iPhone: tap Share → Add to Home Screen.\nOn Android: tap the menu (⋮) → Install App.");
  };

  return (
    <div className="min-h-screen bg-background dark" style={{ marginTop: "calc(-1 * env(safe-area-inset-top, 0px))", paddingTop: "env(safe-area-inset-top, 0px)" }}>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/30 bg-background backdrop-blur-xl" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold tracking-tight gold-gradient">Envo Pool</Link>
          <div className="flex items-center gap-3">
            <Link to="/tournaments" className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition-colors">Tournaments</Link>
            {user ? (
              <>
                {user.isAdmin && (
                  <Link to="/admin">
                    <Button variant="outline" size="sm" className="border-accent/40 text-accent hover:bg-accent/10">Admin</Button>
                  </Link>
                )}
                <Link to="/dashboard">
                  <Button variant="outline" size="sm" className="border-accent text-accent hover:bg-accent hover:text-accent-foreground">Dashboard</Button>
                </Link>
                <Button onClick={handleBookNow} size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">Book Now</Button>
              </>
            ) : (
              <>
                <Link to="/auth">
                  <Button variant="outline" size="sm" className="border-accent text-accent hover:bg-accent hover:text-accent-foreground">Sign In</Button>
                </Link>
                <Button onClick={handleBookNow} size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">Book Now</Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={HERO_IMAGE.src}
            srcSet={HERO_IMAGE.srcSet}
            sizes={HERO_IMAGE.sizes}
            width={1920}
            height={1280}
            alt="Envo Pool's main hall in Singapore, with competition pool tables under branded VIP table lights"
            className="w-full h-full object-cover"
            loading="eager"
            decoding="async"
            {...{ fetchpriority: "high" }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/60 to-transparent" />
        </div>
        <div className="relative z-10 mx-auto max-w-5xl px-6 text-center pt-20">
          <p className="text-accent uppercase tracking-[0.3em] text-xs md:text-sm font-medium mb-4">Made for pool players by pool players.</p>
          <h1 className="text-xl md:text-3xl font-semibold tracking-wide text-foreground mb-5">Pool Hall in Singapore</h1>
          {/* Brand headline, kept as the big visual title under the H1. */}
          <h2 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.9] mb-8">
            <span className="gold-gradient">Elevate</span><br />
            <span className="text-foreground">Your Game</span>
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Envo Pool is a pool hall in Singapore at {BUSINESS.building}, a 4-minute walk from Paya Lebar MRT. Play American pool and Chinese pool on competition-grade tables with tournament-quality balls — and book your table online in seconds.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button onClick={handleBookNow} size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 px-8 text-base">
              Reserve a Table <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <a href="#about">
              <Button size="lg" variant="outline" className="border-accent/30 text-accent hover:bg-accent/10 px-8 text-base">Learn More</Button>
            </a>
          </div>
        </div>
        <a href="#about" aria-label="Scroll down to learn more about Envo Pool" className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <ChevronDown className="h-6 w-6 text-accent/60" />
        </a>
      </section>

      {/* Why Envo Pool */}
      <section id="about" className="py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-accent uppercase tracking-[0.2em] text-xs font-medium mb-4">The Envo Difference</p>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
                <span className="gold-gradient">Redefining</span>{" "}
                <span className="text-foreground">Pool Culture in Singapore</span>
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Envo Pool isn't your average pool hall. We're a premium, technology-integrated space in Paya Lebar designed from the ground up for pool players. From competition-grade Aileex and Xing Pai tables to Dynasphere Palladium balls — every detail is chosen to deliver a professional playing experience. Powered by smart booking, digital wallets, and a rewards system that grows with you.
              </p>
            </div>
            <div className="relative">
              <img src={poolBalls} width={720} height={720} alt="Racked set of Dynaspheres Palladium competition pool balls at Envo Pool" className="rounded-2xl w-full object-cover aspect-square" loading="lazy" decoding="async" />
              <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-accent/10" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 md:py-32 border-t border-border/30">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <p className="text-accent uppercase tracking-[0.2em] text-xs font-medium mb-4">The Envo Difference</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              <span className="gold-gradient">Built for</span>{" "}<span className="text-foreground">Performance</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Target, title: "Competition-Grade Tables", desc: "10 American pool tables and 4 Chinese pool tables. Aileex and Xing Pai — the same brands trusted at professional tournaments." },
              { icon: Star, title: "Tournament-Quality Balls", desc: "Dynasphere Palladium balls — precision-engineered for consistent roll, perfect roundness, and tournament-level play." },
              { icon: Cpu, title: "Smart Booking System", desc: "Book tables in advance or walk in and start a timer. Real-time availability, instant confirmations, zero waiting." },
              { icon: Trophy, title: "Rewards & Membership", desc: "Earn points on every dollar spent. Unlock milestone rewards, exchange points for perks, and get member-exclusive benefits." },
            ].map((f, i) => (
              <div key={i} className="card-premium rounded-2xl p-8 group hover:border-accent/20 transition-all duration-300">
                <f.icon className="h-8 w-8 text-accent mb-5" />
                <h3 className="text-lg font-semibold text-foreground mb-3">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* American & Chinese pool at Paya Lebar */}
      <section className="py-24 md:py-32 border-t border-border/30">
        <div className="mx-auto max-w-4xl px-6">
          <div className="text-center mb-12">
            <p className="text-accent uppercase tracking-[0.2em] text-xs font-medium mb-4">Play Your Game</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              <span className="gold-gradient">American & Chinese Pool</span>{" "}<span className="text-foreground">at Paya Lebar</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card-premium rounded-2xl p-8">
              <h3 className="text-lg font-semibold text-foreground mb-3">American pool</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Our 10 American pool tables are built for 8-ball, 9-ball and 10-ball, with tournament-spec cushions and Dynasphere Palladium balls. Whether you're practising drills on your own or playing a long session with friends, they play just like the tables used at professional tournaments.
              </p>
            </div>
            <div className="card-premium rounded-2xl p-8">
              <h3 className="text-lg font-semibold text-foreground mb-3">Chinese pool</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Prefer Chinese 8-ball? We have 4 dedicated Chinese pool tables, so you can switch between American pool and Chinese pool without leaving the hall — a rare combination for a pool hall in Singapore.
              </p>
            </div>
          </div>
          <p className="text-muted-foreground leading-relaxed text-center mt-10 max-w-3xl mx-auto">
            You'll find us in the basement of {BUSINESS.building} at {BUSINESS.streetAddress.replace(/, #.*$/, "")}, a short 4-minute walk from Paya Lebar MRT (East-West and Circle lines). Open late every night — until 1am from Monday to Thursday and 2am from Friday to Sunday — it's an easy pool hall to reach from anywhere in Singapore.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 md:py-32 border-t border-border/30">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <p className="text-accent uppercase tracking-[0.2em] text-xs font-medium mb-4">Seamless Experience</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              <span className="gold-gradient">Up and running</span>{" "}<span className="text-foreground">in minutes</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-4 gap-8 relative">
            <div className="hidden md:block absolute top-8 left-[12.5%] right-[12.5%] h-px bg-accent/20" />
            {[
              { num: "01", title: "Verify with Singpass", desc: "Sign up and verify your identity instantly using Singpass MyInfo. No forms, no waiting." },
              { num: "02", title: "Top Up Your Wallet", desc: "Add credits to your Envo wallet via PayNow. Your balance is always ready when you are." },
              { num: "03", title: "Book or Walk In", desc: "Reserve a table in advance or simply walk in and start a session timer. You're in control." },
              { num: "04", title: "Earn Rewards", desc: "Every dollar spent earns you points. Redeem for free sessions, drinks, merchandise and more." },
            ].map((step, i) => (
              <div key={i} className="text-center relative">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 border border-accent/20 mb-4 relative z-10">
                  <span className="text-accent font-bold text-lg">{step.num}</span>
                </div>
                <h3 className="text-foreground font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Equipment Highlights */}
      <section className="py-24 md:py-32 border-t border-border/30">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="relative order-2 md:order-1">
              <img src={poolTech} width={720} height={720} alt="Competition-grade 9-foot American pool table at Envo Pool, Paya Lebar" className="rounded-2xl w-full object-cover aspect-square" loading="lazy" decoding="async" />
              <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-accent/10" />
            </div>
            <div className="order-1 md:order-2">
              <p className="text-accent uppercase tracking-[0.2em] text-xs font-medium mb-4">World-Class Equipment</p>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-8">
                <span className="gold-gradient">Pool,</span>{" "}<span className="text-foreground">Uncompromised</span>
              </h2>
              <div className="space-y-6">
                <div className="card-premium rounded-2xl p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold text-foreground">Aileex & Xing Pai Tables</h3>
                    <span className="text-xs bg-accent/10 text-accent px-2 py-1 rounded-full whitespace-nowrap ml-2">10 American · 4 Chinese</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">10 American pool tables and 4 Chinese pool tables, sourced from brands trusted at the highest levels of competition. Tournament-spec cushions, premium grey cloth, and precision levelling for a consistent play surface every time.</p>
                </div>
                <div className="card-premium rounded-2xl p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold text-foreground">Dynasphere Palladium Balls</h3>
                    <span className="text-xs bg-accent/10 text-accent px-2 py-1 rounded-full whitespace-nowrap ml-2">Tournament Grade</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">Used at elite tournaments worldwide. Engineered for perfect sphericity, consistent density, and exceptional durability. The difference is felt on every shot.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Install App CTA */}
      <section className="py-24 md:py-32 border-t border-border/30">
        <div className="mx-auto max-w-3xl px-6">
          <div className="card-premium rounded-2xl p-10 text-center border-accent/20 ring-1 ring-accent/10">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              <span className="gold-gradient">Envo Pool</span>{" "}<span className="text-foreground">in Your Pocket</span>
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Install the Envo Pool app directly on your phone — no App Store needed. Instant access to bookings, your wallet, rewards and session history.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button onClick={handleInstallApp} size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 px-8">Add to Home Screen</Button>
              <Button onClick={handleBookNow} size="lg" variant="outline" className="border-accent/30 text-accent hover:bg-accent/10 px-8">Book a Table</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-6">Works on iPhone and Android. Free forever.</p>
          </div>
        </div>
      </section>

      {/* Location & Hours */}
      <section className="py-24 md:py-32 border-t border-border/30">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-16">
            <p className="text-accent uppercase tracking-[0.2em] text-xs font-medium mb-4">Find Us</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              <span className="gold-gradient">Visit</span>{" "}<span className="text-foreground">Envo Pool</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div className="card-premium rounded-2xl p-6 space-y-5">
              <div>
                <p className="text-xs text-accent uppercase tracking-widest mb-1">Address</p>
                <address className="not-italic">
                  <p className="text-foreground font-medium">{BUSINESS.streetAddress}</p>
                  <p className="text-foreground font-medium">{BUSINESS.building}, Singapore {BUSINESS.postalCode}</p>
                </address>
              </div>
              <div>
                <p className="text-xs text-accent uppercase tracking-widest mb-1">Nearest MRT</p>
                <p className="text-foreground">{BUSINESS.mrt} — 4 min walk</p>
              </div>
              <div>
                <p className="text-xs text-accent uppercase tracking-widest mb-1">Phone</p>
                <a href={BUSINESS.phoneHref} className="text-foreground font-medium hover:text-accent transition-colors">{BUSINESS.phone}</a>
              </div>
              <div>
                <p className="text-xs text-accent uppercase tracking-widest mb-2">Opening Hours</p>
                {OPENING_HOURS.map((h) => (
                  <div key={h.label} className="flex justify-between gap-3 text-sm border-b border-border/30 py-2 first:pt-0">
                    <span className="text-muted-foreground">{h.label}</span>
                    <span className="text-foreground font-medium">{h.display}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm pt-2">
                  <span className="text-muted-foreground">Private Members</span>
                  <span className="text-accent font-medium">24/7 Access</span>
                </div>
              </div>
              <a href={BUSINESS.mapsUrl} target="_blank" rel="noopener noreferrer">
                <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                  Get Directions <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
            </div>
            <div className="space-y-4">
            <figure className="relative rounded-2xl overflow-hidden ring-1 ring-accent/10">
              <img
                src={entrance1200}
                srcSet={`${entrance640} 640w, ${entrance1200} 1200w`}
                sizes="(min-width: 768px) 50vw, 100vw"
                width={1200}
                height={675}
                alt="Entrance of Envo Pool at Grandlink Square, 511 Guillemard Road, with the lit ENVO POOL sign"
                className="w-full object-cover aspect-video"
                loading="lazy"
                decoding="async"
              />
              <figcaption className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-background/90 to-transparent px-4 pb-3 pt-8 text-sm text-foreground">
                Look for the lit <span className="text-accent font-medium">ENVO POOL</span> sign at basement level
              </figcaption>
            </figure>
            <div className="rounded-2xl overflow-hidden ring-1 ring-accent/10" style={{ minHeight: "320px" }}>
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3988.8083782233!2d103.89068747460635!3d1.3162054986939!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31da181563e748a9%3A0xa4c80f429d4b7bcc!2s511+Guillemard+Rd%2C+Singapore+399849!5e0!3m2!1sen!2ssg!4v1"
                title="Map showing Envo Pool at Grandlink Square, near Paya Lebar MRT"
                width="100%"
                height="320"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ — same text as the FAQPage structured data (src/seo/site.ts) */}
      <section id="faq" className="py-24 md:py-32 border-t border-border/30">
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-center mb-12">
            <p className="text-accent uppercase tracking-[0.2em] text-xs font-medium mb-4">Good to Know</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              <span className="gold-gradient">Frequently Asked</span>{" "}<span className="text-foreground">Questions</span>
            </h2>
          </div>
          <div className="space-y-3">
            {FAQ.map((f, i) => (
              <details key={f.q} className="group card-premium rounded-xl px-5 py-4" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-foreground [&::-webkit-details-marker]:hidden">
                  <h3 className="text-base">{f.q}</h3>
                  <ChevronDown className="h-4 w-4 shrink-0 text-accent transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </details>
            ))}
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
            Book your table in seconds. No calls, no queues — just show up and play on the best equipment in Singapore.
          </p>
          <Button onClick={handleBookNow} size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 px-10 text-base">
            Reserve Your Table <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 py-12">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="gold-gradient text-lg font-bold">Envo Pool</p>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms & Conditions</Link>
            <Link to="/auth" className="hover:text-foreground transition-colors">Sign In</Link>
            <Link to="/tournaments" className="hover:text-foreground transition-colors">Tournaments</Link>
            <Link to="/booking" className="hover:text-foreground transition-colors">Book Now</Link>
          </div>
          <div className="text-center md:text-right">
            <p className="text-xs text-muted-foreground">{BUSINESS.streetAddress}, {BUSINESS.building}, Singapore {BUSINESS.postalCode} · <a href={BUSINESS.phoneHref} className="hover:text-foreground transition-colors">{BUSINESS.phone}</a></p>
            <p className="text-xs text-muted-foreground mt-1">Open {HOURS_SHORT}</p>
            <p className="text-xs text-muted-foreground mt-1">© {new Date().getFullYear()} Envo Pool. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
