import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Target, Cpu, Trophy, ArrowRight, ChevronDown, Star } from "lucide-react";
import heroImage from "@/assets/hero-pool.jpg";
import poolBalls from "@/assets/pool-balls.jpg";
import poolTech from "@/assets/pool-tech.jpg";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

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
          <h1 className="text-xl font-bold tracking-tight gold-gradient">Envo Pool</h1>
          <div className="flex items-center gap-3">
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
          <img src={heroImage} alt="Premium pool hall" className="w-full h-full object-cover" loading="eager" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/60 to-transparent" />
        </div>
        <div className="relative z-10 mx-auto max-w-5xl px-6 text-center pt-20">
          <p className="text-accent uppercase tracking-[0.3em] text-sm font-medium mb-6">Made for pool players by pool players.</p>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.9] mb-8">
            <span className="gold-gradient">Elevate</span><br />
            <span className="text-foreground">Your Game</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Singapore's most advanced pool hall. Competition-grade tables, tournament-quality balls, and a tech-integrated experience built for serious players.
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
        <a href="#about" className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 animate-bounce">
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
                Envo Pool isn't your average hall. We're a premium, technology-integrated space designed from the ground up for pool players. From competition-grade Aileex and Xing Pai tables to Dynasphere Palladium balls — every detail is chosen to deliver a professional playing experience. Powered by smart booking, digital wallets, and a rewards system that grows with you.
              </p>
            </div>
            <div className="relative">
              <img src={poolBalls} alt="Competition-grade billiard balls" className="rounded-2xl w-full object-cover aspect-square" loading="lazy" />
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
              <img src={poolTech} alt="Technology-integrated modern pool hall" className="rounded-2xl w-full object-cover aspect-square" loading="lazy" />
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
                <p className="text-foreground font-medium">511 Guillemard Road, #B1-02A</p>
                <p className="text-foreground font-medium">Singapore 399849</p>
              </div>
              <div>
                <p className="text-xs text-accent uppercase tracking-widest mb-1">Nearest MRT</p>
                <p className="text-foreground">Paya Lebar MRT (EW8/CC9) — 4 min walk</p>
              </div>
              <div>
                <p className="text-xs text-accent uppercase tracking-widest mb-2">Opening Hours</p>
                <div className="flex justify-between text-sm border-b border-border/30 pb-2">
                  <span className="text-muted-foreground">Monday – Sunday</span>
                  <span className="text-foreground font-medium">10:00 AM – 1:00 AM</span>
                </div>
                <div className="flex justify-between text-sm pt-2">
                  <span className="text-muted-foreground">Private Members</span>
                  <span className="text-accent font-medium">24/7 Access</span>
                </div>
              </div>
              <a href="https://maps.google.com/?q=511+Guillemard+Road+Singapore" target="_blank" rel="noopener noreferrer">
                <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                  Get Directions <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
            </div>
            <div className="rounded-2xl overflow-hidden ring-1 ring-accent/10" style={{ minHeight: "320px" }}>
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3988.8083782233!2d103.89068747460635!3d1.3162054986939!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31da181563e748a9%3A0xa4c80f429d4b7bcc!2s511+Guillemard+Rd%2C+Singapore+399849!5e0!3m2!1sen!2ssg!4v1"
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
            <Link to="/booking" className="hover:text-foreground transition-colors">Book Now</Link>
          </div>
          <div className="text-center md:text-right">
            <p className="text-xs text-muted-foreground">511 Guillemard Road, #B1-02A, Singapore 399849</p>
            <p className="text-xs text-muted-foreground mt-1">© {new Date().getFullYear()} Envo Pool. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
