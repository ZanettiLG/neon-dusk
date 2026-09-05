import { useMemo } from "react";
import manifest from "../../../docs/design/asset-manifest.json";
import registryJson from "../../../tools/asset-forge/registry.json";
import { tokens } from "@/lib/tokens";

/** Raw SVG strings, keyed by path relative to this file. */
const icons = import.meta.glob("../assets/icons/*.svg", {
  query: "?raw",
  eager: true,
  import: "default",
}) as Record<string, string>;

/**
 * Raster assets (AI-generated, registry v2). One static glob per directory
 * instead of a single brace glob: the terminology guard (scripts/check-
 * terminologia.mjs, #136) flags "chrome" and "gig" as bare words, and the
 * brace form has no `/` before them; each per-dir pattern below carries the
 * slash the guard's CODE_ALLOWED expects. Same file set at runtime.
 */
const rasterAssets = {
  ...import.meta.glob("../assets/chrome/*.{png,webp,avif}", { query: "?url", eager: true }),
  ...import.meta.glob("../assets/scenes/*.{png,webp,avif}", { query: "?url", eager: true }),
  ...import.meta.glob("../assets/items/*.{png,webp,avif}", { query: "?url", eager: true }),
  ...import.meta.glob("../assets/portraits/*.{png,webp,avif}", { query: "?url", eager: true }),
  ...import.meta.glob("../assets/backdrops/*.{png,webp,avif}", { query: "?url", eager: true }),
  ...import.meta.glob("../assets/gig-art/*.{png,webp,avif}", { query: "?url", eager: true }),
} as Record<string, string>;

interface ManifestAsset {
  id: string;
  category: string;
  name: string;
  alt: string;
  file: string;
  colorToken: string;
}

interface RegistryType {
  id: string;
  regime: "flat" | "atmospheric";
  size: { width: number; height: number };
  output: { dir: string; filename: string | null };
  postprocess: { rembg: boolean } | null;
}

interface RegistrySeedFamily {
  id: string;
  type: string;
  members: string[];
}

interface RegistryV2 {
  version: number;
  types: RegistryType[];
  seedFamilies: RegistrySeedFamily[];
}

const registry = registryJson as RegistryV2;

/** Raster types = everything except `icon`, whose section comes from the manifest. */
const RASTER_TYPES = registry.types.filter((t) => t.id !== "icon");

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

/** Files generated for a raster type, keyed by its output dir basename. */
function assetsForType(dirBase: string): { name: string; url: string }[] {
  return Object.entries(rasterAssets)
    .filter(([key]) => key.includes(`/assets/${dirBase}/`))
    .map(([key, url]) => ({ name: key.split("/").pop() ?? key, url }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Dev-only showcase of the 35 P0 icons + raster assets (route /dev/icons, not linked in prod nav). */
export default function IconGalleryView() {
  const sections = useMemo(() => {
    const assets = manifest.assets as ManifestAsset[];
    const known = new Set(Object.keys(SECTION_TITLES));
    if (import.meta.env.DEV) {
      for (const category of new Set(assets.map((a) => a.category))) {
        if (!known.has(category)) {
          console.warn(`IconGallery: categoria não reconhecida no manifest: ${category}`);
        }
      }
    }
    return Object.keys(SECTION_TITLES).map((category) => ({
      title: SECTION_TITLES[category],
      assets: assets.filter((a) => a.category === category),
    }));
  }, []);

  return (
    <div className="min-h-screen bg-nd-bg px-4 py-8 font-body text-nd-text md:px-8">
      <header className="mb-8">
        <h1 className="font-heading text-2xl text-nd-cyan">DEV — Galeria de Assets</h1>
        <p className="mt-1 text-sm text-nd-text-secondary">
          Preview interno — registry v{registry.version} · manifest v{manifest.version}.
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
                      aria-hidden="true"
                      dangerouslySetInnerHTML={{ __html: svg ?? "" }}
                    />
                    <span
                      className="block h-8 w-8 [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
                      aria-hidden="true"
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

      {RASTER_TYPES.map((type) => {
        const dirBase = type.output.dir.split("/").pop() ?? "";
        const assets = assetsForType(dirBase);
        const families = registry.seedFamilies.filter((f) => f.type === type.id);
        return (
          <section key={type.id} className="mb-10">
            <h2 className="mb-4 font-heading text-lg text-nd-gold">{type.id}</h2>
            <div className="mb-4 border border-nd-dead-gray bg-nd-surface p-3 font-data text-xs text-nd-text-secondary">
              <span className="text-nd-cyan">
                {type.size.width}×{type.size.height}
              </span>{" "}
              · regime {type.regime} · postprocess{" "}
              {type.postprocess ? `rembg: ${type.postprocess.rembg}` : "—"} · {type.output.dir}
              {families.map((family) => (
                <div key={family.id} className="mt-1 text-nd-text">
                  {family.id}: {family.members.join(", ")}
                </div>
              ))}
            </div>
            {assets.length === 0 ? (
              <div className="border border-dashed border-nd-dead-gray bg-nd-surface p-4 text-sm text-nd-text-secondary">
                <span className="font-data text-nd-cyan">{type.id}</span> ·{" "}
                {type.size.width}×{type.size.height} · {type.output.dir}
                <span className="mt-1 block">
                  não gerado — rode{" "}
                  <code className="font-data">node tools/asset-forge/cli.mjs generate {type.id}</code>
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {assets.map((asset) => (
                  <figure
                    key={asset.name}
                    className="border border-nd-dead-gray bg-nd-surface p-3"
                  >
                    <img
                      src={asset.url}
                      alt={`${type.id} — ${asset.name}`}
                      loading="lazy"
                      className="max-h-64 w-full object-contain"
                    />
                    <figcaption className="mt-2 font-data text-xs text-nd-text-secondary">
                      {asset.name}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}