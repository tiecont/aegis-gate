import { foundation } from "../lib/foundation.mjs";

export default function Home() {
  return (
    <main>
      <header>
        <span className="mark" aria-hidden="true">
          A
        </span>
        <strong>AegisGate</strong>
        <span className="environment">LOCAL</span>
      </header>
      <section className="intro">
        <p className="eyebrow">DEVELOPMENT WORKSPACE</p>
        <h1>Your gateway starts with a secure foundation.</h1>
        <p className="description">
          The workspace is running. Tenant management and customer traffic
          become available after their implementation and security gates pass.
        </p>
      </section>
      <dl className="status" aria-label="Workspace status">
        <div>
          <dt>Implementation phase</dt>
          <dd>{foundation.phase}</dd>
        </div>
        <div>
          <dt>Management API</dt>
          <dd>{foundation.management}</dd>
        </div>
        <div>
          <dt>Customer traffic</dt>
          <dd>{foundation.traffic}</dd>
        </div>
        <div>
          <dt>Release level</dt>
          <dd>{foundation.release}</dd>
        </div>
      </dl>
      <aside>
        <span aria-hidden="true">●</span>
        <p>
          There is no connected tenant session. No customer resources are shown
          on this public development page.
        </p>
      </aside>
      <footer>
        Implementation progress and gate evidence are maintained in
        IMPLEMENTATION_STATUS.md.
      </footer>
    </main>
  );
}
