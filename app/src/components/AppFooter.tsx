/** App footer tagline (port of AppFooter.vue). Hidden on mobile — the bottom
 * nav owns the mobile footer space (issue #13). */
export default function AppFooter() {
  return (
    <footer className="hidden sm:block bg-nd-surface border-t border-nd-cyan/10 px-4 py-3">
      <p className="text-nd-text-secondary text-xs text-center font-data">
        Monta teu cromo. Queima teu nome. Vira lenda.
      </p>
    </footer>
  );
}
