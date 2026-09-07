import { ArrowRight, Sparkles, Mic2 } from "lucide-react";

export default function LandingPage({
  onSignup,
  onLogin,
}: {
  onSignup: () => void;
  onLogin: () => void;
}) {
  return (
    <main className="synora-page">

      {/* SKY BACKGROUND */}
      <div className="sky-glow sky-glow-one" />
      <div className="sky-glow sky-glow-two" />

      <div className="stars">
        <span>✦</span>
        <span>✧</span>
        <span>✦</span>
        <span>·</span>
        <span>✧</span>
      </div>

      {/* FLOATING CLOUDS */}
      <div className="sky-cloud cloud-left">
        <div className="cloud-piece piece-one" />
        <div className="cloud-piece piece-two" />
        <div className="cloud-piece piece-three" />
      </div>

      <div className="sky-cloud cloud-right">
        <div className="cloud-piece piece-one" />
        <div className="cloud-piece piece-two" />
        <div className="cloud-piece piece-three" />
      </div>

      <div className="sky-cloud cloud-bottom">
        <div className="cloud-piece piece-one" />
        <div className="cloud-piece piece-two" />
        <div className="cloud-piece piece-three" />
      </div>

      {/* NAVBAR */}
      <nav className="navbar">

        <div className="logo">
  <img
    src="/synora-logo.png"
    alt="Synora"
    className="synora-logo-image"
  />
</div>
         

       <div className="nav-actions">
          <button className="nav-link">How it works</button>
          <button className="login-button" onClick={onLogin}>Log in</button>
          <button className="signup-button" onClick={onSignup}>
  Sign up
</button>
       </div>

      </nav>

      {/* HERO */}
      <section className="hero">

        <div className="hero-copy">

          <div className="eyebrow">
            <Sparkles size={14} />
            <span>Your personal memory companion</span>
          </div>

          <h1>
            Your brain
            <br />
            <span>forgets.</span>
            <br />
            <em>Synora doesn't.</em>
          </h1>

          <p className="hero-description">
            An AI that calls you to test what you actually remember,
            uncover misconceptions, and help make learning stick.
          </p>

          <div className="hero-actions">

            <button className="sky-button" onClick={onSignup}>
              <span>Start remembering</span>
              <ArrowRight size={18} />
            </button>

            <button className="listen-button">
              <span className="listen-icon">
                <Mic2 size={15} />
              </span>
              See how it works
            </button>

          </div>

          <p className="tiny-note">
            No endless revision. Just smarter recall.
          </p>

        </div>

        {/* MEMORY CLOUD */}
        <div className="memory-scene">
       

          <div className="memory-halo" />
          <div className="sun-glow">
         <div className="sun-core" />
        </div>

         

          <div className="memory-cloud">

            <div className="memory-cloud-top">
              <span>YOUR MEMORY</span>

              <div className="memory-status">
                <i />
                LIVE
              </div>
            </div>

            <div className="memory-center">

              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />

              <div className="score">
                <strong>82</strong>
                <span>%</span>
              </div>

              <div className="topic topic-one">
                <span>⌘</span>
                Hashing
              </div>

              <div className="topic topic-two">
                <span>✦</span>
                Networks
              </div>

              <div className="topic topic-three">
                <span>♡</span>
                Crypto
              </div>

            </div>

            <div className="memory-message">

              <div className="message-sparkle">
                ✦
              </div>

              <div>
                <small>Synora noticed</small>
                <strong>Hashing needs a little love</strong>
              </div>

              <ArrowRight size={17} />

            </div>

            <div className="memory-stats">

              <div>
                <strong>8</strong>
                <span>mastered</span>
              </div>

              <div>
                <strong>2</strong>
                <span>fading</span>
              </div>

              <div>
                <strong>1</strong>
                <span>misconception</span>
              </div>

            </div>

          </div>

          {/* LITTLE FLOATING CLOUDS */}
          <div className="mini-cloud mini-cloud-one" />
          <div className="mini-cloud mini-cloud-two" />

          <div className="floating-spark spark-one">✦</div>
          <div className="floating-spark spark-two">✧</div>
          <div className="floating-spark spark-three">·</div>

        </div>

      </section>

      {/* BOTTOM CLOUD EDGE */}
      <div className="cloud-edge">
        <div />
        <div />
        <div />
        <div />
      </div>

    </main>
  );
}