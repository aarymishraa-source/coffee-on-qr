// Landing page markup — a straight port of design/landing-reference.html.
// Static and server-rendered; all behaviour lives in LandingEffects (client)
// and the 3D cup in Hero3D (client-only).
import { Bricolage_Grotesque } from "next/font/google";
import { LandingEffects } from "./LandingEffects";
import { Hero3DLoader } from "./Hero3DLoader";
import "./landing.css";

// The reference uses Bricolage's optical-size axis, so load the variable font with opsz.
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], axes: ["opsz"], variable: "--lp-display" });

// Set the `js` flag before first paint (as the reference does) so reveal
// elements don't flash visible before their scroll animations take over.
const EARLY_FLAG = `(function(){try{if(!matchMedia("(prefers-reduced-motion: reduce)").matches)document.getElementById("lp").classList.add("js")}catch(e){}})();`;

const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const Tick = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const INGREDIENTS = ["Basil pesto", "Paneer", "Roasted peppers", "Cold brew", "Mushroom", "Sourdough", "Chilli", "Blueberry", "Spinach", "Rocket"];

export function Landing() {
  return (
    <div id="lp" className={`lp ${bricolage.variable}`} suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: EARLY_FLAG }} />
      <div className="grain" aria-hidden="true"></div>

      <header className="nav" id="nav">
        <a className="brand" href="#top" aria-label="Coffee on QR home">
          <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><rect width="34" height="34" rx="10" fill="#2E4A2C" /><rect x="8.5" y="7" width="17" height="20" rx="6" fill="none" stroke="#A8C47A" strokeWidth="2.4" /><path d="M19.5 11.5c-1.2-1-4.6-1-4.6 1.4 0 2.6 4.4 1.6 4.4 4.3 0 2.2-3.3 2.4-4.8 1.2" fill="none" stroke="#A8C47A" strokeWidth="2.2" strokeLinecap="round" /></svg>
          <span>coffee <b>on</b> qr</span>
        </a>
        <nav className="nav-links" aria-label="Sections">
          <a href="#problem">Problem</a><a href="#thermal">Thermal Debt</a><a href="#loop">How it works</a><a href="#try">Try it</a><a href="#traction">Traction</a>
        </nav>
        <a className="btn btn-dark btn-sm magnetic" href="/app">Open app <Arrow /></a>
      </header>

      <main id="top">
        {/* HERO */}
        <section className="hero">
          <div className="blob a" aria-hidden="true"></div><div className="blob b" aria-hidden="true"></div>
          <div className="wrap hero-grid">
            <div>
              <h1 className="display" id="heroTitle" aria-label="Taste, matched. Freshness, measured. Nothing wasted.">
                <span className="line"><span className="w">Taste,</span> <span className="w">matched.</span></span>
                <span className="line"><span className="w">Freshness,</span> <span className="w">measured.</span></span>
                <span className="line green"><span className="w">Nothing</span> <span className="w">wasted.</span></span>
              </h1>
              <p className="hero-sub rv-h">The AI layer for cafés. Customers find food that fits their taste, staff see how long every batch has really been out of range, and food that would go unsold reaches the right people while it&apos;s still safe to sell.</p>
              <div className="hero-cta rv-h">
                <a className="btn btn-dark magnetic" href="/app">Try the app <Arrow /></a>
                <a className="btn btn-ghost magnetic" href="/console">See the café console</a>
              </div>
              <div className="hero-proof rv-h">
                <div><strong>4 cafés</strong><span>already live on Coffee on QR</span></div>
                <div><strong>₹50,000</strong><span>revenue generated</span></div>
                <div><strong>30 days</strong><span>pilot, measured from day one</span></div>
              </div>
            </div>

            <div className="stage" id="stage">
              <Hero3DLoader />
              <div className="stage-fallback" aria-hidden="true">
                <svg width="300" height="300" viewBox="0 0 300 300"><ellipse cx="150" cy="240" rx="120" ry="22" fill="#2E4A2C" /><path d="M60 110h180l-20 120a20 20 0 0 1-20 16H100a20 20 0 0 1-20-16Z" fill="#FBFAF5" stroke="#E4E0D3" /><ellipse cx="150" cy="110" rx="90" ry="18" fill="#A8C47A" /><path d="M240 140c40 0 40 60 0 60" fill="none" stroke="#FBFAF5" strokeWidth="16" strokeLinecap="round" /></svg>
              </div>
              <div className="float-chip c1" data-depth="18"><span className="dot"></span><span><b>4.2°C</b> · Within limits</span></div>
              <div className="float-chip c2" data-depth="-24"><span className="badge">96% match</span><span>Pesto Paneer Sandwich</span></div>
              <div className="float-chip c3" data-depth="30"><span className="tag-off">30% off</span><span><s>₹220</s> <span className="price">₹154</span></span></div>
            </div>
          </div>
        </section>

        <div className="marquee" aria-hidden="true">
          <div className="marquee-track">
            {[...INGREDIENTS, ...INGREDIENTS].map((name, i) => <span key={i}>{name}</span>)}
          </div>
        </div>

        {/* PROBLEM */}
        <section className="problem sec" id="problem">
          <div className="wrap">
            <h2 className="display sec-title rv">Most food waste is decided hours before closing.</h2>
            <p className="sec-lead rv">Cafés guess demand, check fridges by hand, and only notice surplus when the shutters come down. By then the only option left is the bin.</p>

            <div className="big-stats">
              <div className="stat-card rv">
                <div className="stat-num"><span className="count" data-to="78.2" data-dec="1">0</span></div>
                <div className="stat-unit">million tonnes of household food wasted in India every year</div>
                <p className="stat-note">That&apos;s about <b style={{ color: "var(--oat)" }}><span className="count" data-to="55" data-dec="0">0</span> kg</b> for every person. Medium-confidence estimate.</p>
              </div>
              <div className="stat-card rv">
                <div className="stat-unit">Where the world&apos;s food waste happens</div>
                <div className="sector-bar" id="sectorBar">
                  <div data-w="60" style={{ background: "var(--matcha)", color: "var(--espresso)" }}>60%</div>
                  <div data-w="28" style={{ background: "var(--crema)", color: "var(--oat)" }}>28%</div>
                  <div data-w="12" style={{ background: "#EDE8DA", color: "var(--espresso)" }}>12%</div>
                </div>
                <div className="legend"><span><i style={{ background: "var(--matcha)" }}></i>Households</span><span><i style={{ background: "var(--crema)" }}></i>Food services</span><span><i style={{ background: "#EDE8DA" }}></i>Retail</span></div>
                <p className="stat-note">Food services, cafés included, carry 28% globally. That&apos;s the slice we start with.</p>
              </div>
            </div>

            <div className="pains">
              <div className="pain rv"><h3>Unsold at closing</h3><p>Demand is a guess, so the last trays of the day go straight to the bin.</p></div>
              <div className="pain rv"><h3>Monitoring with gaps</h3><p>A fridge reading says what the temperature is now, not how long food spent too warm this afternoon.</p></div>
              <div className="pain rv"><h3>Missed customers</h3><p>People nearby would happily buy that dish, but nobody tells them it exists.</p></div>
            </div>
            <p className="source">Source: UNEP Food Waste Index Report 2024. Sector shares are global figures, not India-specific.</p>
          </div>
        </section>

        {/* THERMAL STORY */}
        <section className="thermal sec" id="thermal">
          <div className="wrap">
            <h2 className="display sec-title rv">A snapshot isn&apos;t the whole story.</h2>
            <p className="sec-lead rv">Our sensor keeps the full time and temperature history of every batch. Thermal Debt adds up how long it spent above the limit, so a cool reading at 10 PM can&apos;t hide a warm afternoon.</p>

            <div className="th-grid">
              <div className="chart-card rv">
                <div className="chart-head">
                  <h3>Veg Sandwich, batch S118</h3>
                  <div className="chart-legend"><span><i style={{ background: "var(--forest)" }}></i>Temperature</span><span><i style={{ background: "var(--signal)" }}></i>Above 5°C limit</span></div>
                </div>
                <svg id="tchart" viewBox="0 0 640 300" role="img" aria-label="Temperature over the day rises above 5 degrees between noon and 3 PM, then falls back to 4.2 degrees."></svg>
              </div>
              <div className="compare">
                <div className="cmp rv">
                  <div className="k">What a fridge display tells you</div>
                  <div className="v">4.2°C</div>
                  <p>Looks fine right now. Nothing about the afternoon.</p>
                </div>
                <div className="cmp dark rv">
                  <div className="k">What Thermal Debt tells you</div>
                  <div className="v" id="debtPct">0%</div>
                  <div className="debt-track"><span id="debtFill"></span></div>
                  <p>of this batch&apos;s safe exposure is already used. About 1 h 50 m of sale window left, so offer it now or not at all.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* LOOP */}
        <section className="loop" id="loop">
          <div className="loop-inner">
            <div className="wrap loop-head">
              <h2 className="display sec-title">One batch. One decision loop.</h2>
              <div style={{ display: "grid", gap: 10 }}>
                <span className="muted" style={{ fontSize: 15 }}>Quality gates the offer. Taste targets it.</span>
                <div className="loop-progress"><span id="loopBar"></span></div>
              </div>
            </div>
            <div className="loop-track" id="loopTrack">
              <article className="step on"><span className="n">01</span><div><div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" /></svg></div><h3>Sensor history</h3><p>Our in-house sensor logs time and temperature for every batch, all day.</p></div></article>
              <article className="step safety"><span className="n">02</span><div><div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg></div><h3>Safety gate</h3><p>Thermal Debt and the café&apos;s own rules decide if a batch can be sold. Sensor offline means unknown, never green.</p></div></article>
              <article className="step"><span className="n">03</span><div><div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></svg></div><h3>Demand forecast</h3><p>Sales history, stock and the time of day predict what will still be on the shelf at closing.</p></div></article>
              <article className="step"><span className="n">04</span><div><div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="m16 11 2 2 4-4" /></svg></div><h3>Manager approval</h3><p>Nothing goes out on its own. The manager approves in the console or replies YES on WhatsApp.</p></div></article>
              <article className="step"><span className="n">05</span><div><div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg></div><h3>Matched offer</h3><p>Only opted-in customers whose taste fits get the offer, with a live countdown to the end of the sale window.</p></div></article>
              <article className="step"><span className="n">06</span><div><div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></svg></div><h3>Learn</h3><p>Reservations, leftovers and alert response times sharpen tomorrow&apos;s forecast and targeting.</p></div></article>
            </div>
          </div>
        </section>

        {/* TRY IT */}
        <section className="sec" id="try">
          <div className="wrap">
            <h2 className="display sec-title rv">Don&apos;t read about it. Try it.</h2>
            <p className="sec-lead rv">The three parts of the loop, small enough to play with right here.</p>

            <div className="feat-grid">
              {/* Taste Match */}
              <article className="feat tilt rv">
                <span className="try">Swipe the card</span>
                <h3>Taste Match</h3>
                <p>Swipe on ingredients, not dishes. The app learns what you like in under a minute.</p>
                <div className="demo-box">
                  <div className="swipe-stack" id="swipeStack" aria-live="polite"></div>
                  <div className="swipe-btns">
                    <button className="rbtn skip" id="btnSkip" aria-label="Skip ingredient"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
                    <button className="rbtn like" id="btnLike" aria-label="Like ingredient"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg></button>
                  </div>
                  <div className="match-out" id="matchOut"><span className="muted">Like a few ingredients to see your top dish.</span></div>
                </div>
              </article>

              {/* Thermal Debt */}
              <article className="feat tilt rv">
                <span className="try">Drag the temperature</span>
                <h3>Thermal Debt</h3>
                <p>Warm it up, then cool it back down. The reading recovers. The debt doesn&apos;t.</p>
                <div className="demo-box">
                  <div className="tdemo-top">
                    <div><div className="muted" style={{ fontSize: 13 }}>Cooked rice tray, now</div><div className="now" id="tNow">4.0°C</div></div>
                    <span className="status within" id="tStatus">Within limits</span>
                  </div>
                  <label htmlFor="tRange" className="sr-only" style={{ position: "absolute", left: -9999 }}>Storage temperature</label>
                  <input className="range" type="range" id="tRange" min="0" max="15" step="0.1" defaultValue="4" />
                  <div className="range-scale"><span>0°C</span><span>5°C limit</span><span>15°C</span></div>
                  <div className="bar"><span id="tBar"></span></div>
                  <div className="tdemo-foot"><span>Thermal Debt</span><span id="tPct">30% used</span></div>
                  <p className="hint" id="tHint">Push it above 5°C and watch the debt build.</p>
                  <button className="linkbtn" id="tReset" style={{ alignSelf: "flex-start", marginTop: 8 }}>Reset batch</button>
                </div>
              </article>

              {/* Second Serve */}
              <article className="feat tilt rv">
                <span className="try">Reserve it</span>
                <h3>Second Serve</h3>
                <p>Likely-unsold food becomes a targeted offer, only after the safety gate and the manager say yes.</p>
                <div className="offer">
                  <div className="offer-img">
                    <span className="tag-off">30% off</span>
                    <svg width="120" height="70" viewBox="0 0 120 70" aria-hidden="true"><path d="M60 6 112 32 60 52 8 32Z" fill="#FBFAF5" /><path d="M8 32v8l52 20 52-20v-8L60 52Z" fill="#E8D9B8" /></svg>
                  </div>
                  <div className="offer-body">
                    <div className="offer-row">
                      <div><h4>Veg Sandwich</h4><small>The Brew Room Café, 0.6 km</small></div>
                      <div><div className="old">₹220</div><span className="new" id="newPrice">₹220</span></div>
                    </div>
                    <div className="timer"><span>Eligible till 8:00 PM</span><b id="timer">01:49:58</b></div>
                    <button className="reserve" id="reserve">Reserve now</button>
                  </div>
                  <div className="why">
                    <div><Tick />Matches your taste: paneer, roasted peppers</div>
                    <div><Tick />Storage checked, within configured limits</div>
                    <div><Tick />Approved by the café manager</div>
                  </div>
                </div>
                <div className="recovered"><span>Recovered today at The Brew Room</span><b id="recovered">₹1,848</b></div>
              </article>
            </div>
          </div>
        </section>

        {/* TRACTION */}
        <section className="wrap" id="traction" style={{ marginBottom: 0 }}>
          <div className="traction sec" style={{ paddingInline: "clamp(22px,4vw,56px)" }}>
            <h2 className="display sec-title rv">We&apos;re not starting from zero.</h2>
            <p className="sec-lead rv">Coffee on QR already runs the QR menu, loyalty and WhatsApp for real cafés. The AI layer plugs into relationships we already have.</p>
            <div className="tr-grid rv">
              <div className="tr"><strong><span className="count" data-to="4">0</span></strong><span>cafés live today</span></div>
              <div className="tr"><strong>₹<span className="count" data-to="50000" data-sep="1">0</span></strong><span>revenue generated</span></div>
              <div className="tr"><strong><span className="count" data-to="100">0</span>+</strong><span>creators in our network</span></div>
              <div className="tr"><strong><span className="count" data-to="10">0</span>+</strong><span>community workshops</span></div>
            </div>
            <div className="next-stop rv"><span className="pulse"></span>Next expansion: Bandra, Mumbai. 30-day pilot with 3 to 5 partner cafés.</div>
          </div>
        </section>

        {/* CTA */}
        <section className="cta sec">
          <div className="wrap">
            <h2 className="display rv"><span>Discover better.</span><span>Monitor smarter.</span><span className="g">Recover value.</span></h2>
            <p className="rv">Watch the whole loop run live: a batch gets blocked, an offer gets approved, and a customer reserves it, all in under two minutes.</p>
            <div className="hero-cta rv">
              <a className="btn btn-matcha magnetic" href="/app">Try the app <Arrow /></a>
              <a className="btn magnetic" style={{ border: "1px solid rgba(255,255,255,.2)" }} href="/demo">Watch the live demo</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="wrap">
          <span>Team SnackOverflow, ADAPPT 5.0, AI in FoodTech</span>
          <p>Decision support only. Sensor readings show monitored conditions; they do not prove food is safe. Staff confirm every action. Figures in demos are illustrative.</p>
        </div>
      </footer>

      <LandingEffects />
    </div>
  );
}
