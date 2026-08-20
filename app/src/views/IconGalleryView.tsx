import { useMemo } from "react";
import manifest from "../../../docs/design/asset-manifest.json";
import { tokens } from "@/lib/tokens";

/** Raw SVG strings, keyed by path relative to this file. */
const icons = import.meta.glob("../assets/icons/*.svg", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>;

interface ManifestAsset {
  id: string;
  category: string;
  name: string;
  alt: string;
  file: string;
  colorToken: string;
}

const SECTION_TITLES: Record<string, string> = {
  "icones-atributos": "Atributos",
  "icones-roles": "Bancas",
  "icones-acoes": "Ações",
  "icones-recursos": "Recursos",
  "molduras-cards": "Molduras de Cards",
  "badges-tier": "Tiers",
  "indicadores-estado": "Estados",
};

function resolveColor(colorToken: string): string {
  return tokens.colors[colorToken as keyof typeof tokens.colors] ?? tokens.colors["nd-text"];
}

/** Dev-only showcase of the 35 P0 icons (route /dev/icons, not linked in prod nav). */
export default function IconGalleryView() {
  const sections = useMemo(() => {
    const assets = manifest.assets as ManifestAsset[];
    return Object.keys(SECTION_TITLES).map((category) => ({
      title: SECTION_TITLES[category],
      assets: assets.filter((a) => a.category === category),
    }));
  }, []);

  return (
    <div className="min-h-screen bg-nd-bg px-4 py-8 font-body text-nd-text md:px-8">
      <header className="mb-8">
        <h1 className="font-heading text-2xl text-nd-cyan">DEV — Galeria de Ícones P0</h1>
        <p className="mt-1 text-sm text-nd-text-secondary">
          Preview interno dos 35 SVGs hand-coded (manifest v{manifest.version}).
        </p>
      </header>

      {sections.map((section) => (
        <section key={section.title} className="mb-10">
          <h2 className="mb-4 font-heading text-lg text-nd-gold">{section.title}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.assets.map((asset) => {
              const filename = asset.file.split("/").pop() ?? "";
              const svg = icons[`../assets/icons/${filename}`];
              return (
                <div
                  key={asset.id}
                  className="flex items-center gap-3 border border-nd-dead-gray bg-nd-surface p-3"
                >
                  <span
                    role="img"
                    aria-label={asset.alt}
                    className="flex shrink-0 items-center gap-2"
                    style={{ color: resolveColor(asset.colorToken) }}
                  >
                    <span
                      className="block h-6 w-6 [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
                      dangerouslySetInnerHTML={{ __html: svg ?? "" }}
                    />
                    <span
                      className="block h-8 w-8 [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
                      dangerouslySetInnerHTML={{ __html: svg ?? "" }}
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-data text-xs text-nd-cyan">{asset.id}</span>
                    <span className="block text-sm">{asset.name}</span>
                    <span className="block font-data text-xs text-nd-text-secondary">
                      {asset.colorToken}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
