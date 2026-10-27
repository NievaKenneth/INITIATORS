
export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="site-header">
        <nav className="nav container" aria-label="Main navigation">
          <a className="brand" href="/" aria-label="HOPE ERP home">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M8.5 12h2l1.2-2.3 1.6 4.6 1.1-2.3h1.1"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span>
              HOPE <span aria-hidden="true">ERP</span>
            </span>
          </a>

          <div className="nav-actions">
            <a className="button button-secondary" href="/login">
              Sign In
            </a>
            <a className="button button-primary" href="/register">
              Register
            </a>
          </div>
        </nav>
      </header>

      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-grid container">
            <div className="hero-content">
              <p className="eyebrow">
                <span className="eyebrow-dot" aria-hidden="true" />
                A clearer way to work
              </p>

              <h1 id="hero-title">
                Bring your work together. <span>Move forward.</span>
              </h1>

              <p className="hero-copy">
                HOPE ERP gives your team one calm, connected place to see
                what&apos;s happening and focus on what matters next.
              </p>

              <div className="hero-actions">
                <a
                  className="button button-primary button-large"
                  href="/register"
                >
                  Get started
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    fill="none"
                    width="18"
                    height="18"
                  >
                    <path
                      d="M4 10h12m-5-5 5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>
                <a
                  className="button button-secondary button-large"
                  href="/login"
                >
                  Sign In
                </a>
              </div>

              <p className="hero-note">
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                  <path
                    d="m5 10 3.2 3.2L15 6.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="10"
                    cy="10"
                    r="8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
                A shared view for the whole team
              </p>
            </div>

            <div
              className="preview-wrap"
              aria-label="Illustrative HOPE ERP dashboard preview"
            >
              <div className="dashboard-preview">
                <div className="preview-topbar">
                  <div>
                    <p className="preview-heading">Team overview</p>
                    <span className="preview-caption">
                      A snapshot of your workspace
                    </span>
                  </div>
                  <span className="preview-avatar" aria-label="Team member: Alex">
                    AL
                  </span>
                </div>

                <div className="preview-content">
                  <p className="preview-label">Workspace at a glance</p>

                  <div className="stat-grid" aria-label="Illustrative workspace summary">
                    <div className="stat-card">
                      <span className="stat-value">12</span>
                      <span className="stat-name">Active projects</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-value">08</span>
                      <span className="stat-name">Team members</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-value">24</span>
                      <span className="stat-name">Tasks this week</span>
                    </div>
                  </div>

                  <div className="activity">
                    <h2 className="activity-heading">Recent activity</h2>

                    {[
                      ["Quarterly planning", "On track"],
                      ["Team check-in", "Updated"],
                      ["Monthly review", "In progress"],
                    ].map(([name, status]) => (
                      <div className="activity-row" key={name}>
                        <div className="activity-name">
                          <span className="activity-icon" aria-hidden="true">
                            <svg viewBox="0 0 20 20" fill="none">
                              <path
                                d="M5 4.5h10v11H5zM7.5 8h5m-5 3h5"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                          <span>{name}</span>
                        </div>
                        <span className="activity-status">{status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section container" aria-labelledby="features-title">
          <div className="section-heading">
            <p className="eyebrow">
              <span className="eyebrow-dot" aria-hidden="true" />
              Less scattered, more connected
            </p>
            <h2 id="features-title">
              Everything in view, so your team can move with confidence.
            </h2>
            <p>
              Bring everyday work into a shared space designed to help people
              stay aligned and make progress together.
            </p>
          </div>

          <div className="feature-grid">
            <article className="feature-card">
              <span className="feature-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="4" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
                  <rect x="14" y="4" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
                  <rect x="4" y="14" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
                  <rect x="14" y="14" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
                </svg>
              </span>
              <h3>A shared workspace</h3>
              <p>
                Keep your team&apos;s work organized and easy to find in one
                connected place.
              </p>
            </article>

            <article className="feature-card">
              <span className="feature-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5 19V9m7 10V5m7 14v-7M3.5 19.5h17"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <h3>Clarity at a glance</h3>
              <p>
                See key updates and priorities together, without losing sight
                of the bigger picture.
              </p>
            </article>

            <article className="feature-card">
              <span className="feature-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20m6-9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm6-6.5a3.5 3.5 0 0 1 0 6.8m2 3.2a3.5 3.5 0 0 1 2 3.2V20"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <h3>Better team alignment</h3>
              <p>
                Give everyone a shared view of progress, responsibilities, and
                what&apos;s next.
              </p>
            </article>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-inner container">
          <p>&copy; {new Date().getFullYear()} HOPE ERP. Built for better work, together.</p>
          <div className="footer-links">
            <a href="/login">Sign In</a>
            <a href="/register">Register</a>
          </div>
        </div>
      </footer>
    </>
  );
}
