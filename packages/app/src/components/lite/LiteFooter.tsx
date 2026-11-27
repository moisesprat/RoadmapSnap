// The two footers of Lite's page (renderFooter in js/ui/page.js): the licence line and the version line. The
// version and build date come from the build-time constants defined in vite.config.ts.
export function LiteFooter() {
  return (
    <>
      <footer className="page-footer">
        © 2026{' '}
        <a href="https://github.com/moises-prat-epm/RoadmapSnap" target="_blank" rel="noopener">
          RoadmapSnap
        </a>{' '}
        · Licensed under the{' '}
        <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener">
          MIT License
        </a>
      </footer>
      <footer className="build-version" aria-label="Build version">
        v{__APP_VERSION__} · Build {__BUILD_DATE__}
      </footer>
    </>
  )
}
