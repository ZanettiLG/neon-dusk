import { useMemo, useState, type FormEvent } from "react";
import type { AttributeKey, Attributes, CreateCharacterRequest, Origin, Role } from "@neon-dusk/shared";
import {
  ATTRIBUTE_KEYS,
  ATTR_TOTAL,
  BASE_ATTRIBUTES,
  MAX_ATTR,
  ORIGINS,
  ROLES,
  SOFT_CAP,
} from "@neon-dusk/shared";
import { ATTRIBUTE_LABELS, ORIGIN_LABELS, ROLE_LABELS, ROLE_PHRASES, ROLE_PRIMARY_ATTRIBUTES } from "@/lib/labels";
import CharacterAvatar from "@/components/CharacterAvatar";

interface CharacterFormProps {
  loading: boolean;
  /** Server-side error on the codinome field (e.g. NAME_TAKEN) — rendered inline. */
  nameError?: string | null;
  /** Called whenever the codinome input changes — lets the parent clear field errors. */
  onNameChange?: () => void;
  onSubmit: (payload: CreateCharacterRequest) => void;
}

/**
 * Character creation form: codinome, origin district, banca and the 22-point
 * attribute spread (5 × 3 base + 7 free, floor 3). Validates locally before
 * calling onSubmit (port of CharacterForm.vue).
 */
export default function CharacterForm({ loading, nameError, onNameChange, onSubmit }: CharacterFormProps) {
  const [name, setName] = useState("");
  const [origin, setOrigin] = useState<Origin | "">("");
  const [role, setRole] = useState<Role | "">("");
  const [attributes, setAttributes] = useState<Attributes>({
    body: BASE_ATTRIBUTES,
    reflexes: BASE_ATTRIBUTES,
    intelligence: BASE_ATTRIBUTES,
    technical: BASE_ATTRIBUTES,
    cool: BASE_ATTRIBUTES,
  });

  const spent = useMemo(
    () => ATTRIBUTE_KEYS.reduce((sum, key) => sum + attributes[key], 0),
    [attributes],
  );
  /** Soft cap penalty: each point above SOFT_CAP effectively costs double. */
  const softCapPenalty = useMemo(
    () => ATTRIBUTE_KEYS.reduce((sum, key) => sum + Math.max(0, attributes[key] - SOFT_CAP), 0),
    [attributes],
  );
  // Effective remaining pool factoring in soft cap penalty.
  const remaining = useMemo(() => ATTR_TOTAL - spent - softCapPenalty, [spent, softCapPenalty]);

  const canIncrease = (key: AttributeKey) => {
    // At or above soft cap: each step costs 2 effective points.
    const needed = attributes[key] >= SOFT_CAP ? 2 : 1;
    return remaining >= needed && attributes[key] < MAX_ATTR;
  };
  // Creation floor is 3 (BASE_ATTRIBUTES): stats never drop below the base line.
  const canDecrease = (key: AttributeKey) => attributes[key] > BASE_ATTRIBUTES;

  function adjust(key: AttributeKey, delta: 1 | -1): void {
    if (delta === 1 && canIncrease(key)) {
      setAttributes((prev) => ({ ...prev, [key]: prev[key] + 1 }));
    }
    if (delta === -1 && canDecrease(key)) {
      setAttributes((prev) => ({ ...prev, [key]: prev[key] - 1 }));
    }
  }

  const valid =
    name.trim().length >= 2 &&
    origin !== "" &&
    role !== "" &&
    remaining === 0;

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    if (!valid) return;
    onSubmit({
      name: name.trim(),
      origin: origin as Origin,
      role: role as Role,
      attributes: { ...attributes },
    });
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {/* Identity */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-nd-text-secondary text-xs uppercase tracking-wider font-data">
            Codinome
          </span>
          <input
            type="text"
            required
            maxLength={24}
            placeholder="Ex.: Navalha, Vulto, Cupim"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              onNameChange?.();
            }}
            className="w-full bg-nd-bg border border-nd-cyan/30 rounded-terminal px-3 py-2 text-nd-text placeholder-nd-text-secondary/40 focus:border-nd-cyan focus:shadow-neon-cyan outline-none"
          />
          {name.length > 0 && name.trim().length < 2 && (
            <p role="alert" className="text-nd-magenta font-data text-xs">
              O codinome precisa de pelo menos 2 caracteres.
            </p>
          )}
          {nameError && (
            <p role="alert" className="text-nd-magenta font-data text-xs">
              {nameError}
            </p>
          )}
        </label>

        <label className="block space-y-1">
          <span className="text-nd-text-secondary text-xs uppercase tracking-wider font-data">
            Distrito de origem
          </span>
          <div className="flex items-center gap-3">
            <select
              value={origin}
              required
              onChange={(e) => setOrigin(e.target.value as Origin | "")}
              className="flex-1 bg-nd-bg border border-nd-cyan/30 rounded-terminal px-3 py-2 text-nd-text focus:border-nd-cyan focus:shadow-neon-cyan outline-none"
            >
              <option value="" disabled>
                Selecione o distrito
              </option>
              {ORIGINS.map((o) => (
                <option key={o} value={o}>
                  {ORIGIN_LABELS[o]}
                </option>
              ))}
            </select>
            <CharacterAvatar origin={origin === "" ? null : origin} size="md" />
          </div>
        </label>

        <div className="block space-y-1 sm:col-span-2">
          <label className="block space-y-1">
            <span className="text-nd-text-secondary text-xs uppercase tracking-wider font-data">
              Banca
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={[
                    "border rounded-terminal px-3 py-2 text-xs font-data uppercase tracking-wider transition-all",
                    role === r
                      ? "border-nd-magenta bg-nd-magenta/10 text-nd-magenta shadow-neon-magenta"
                      : "border-nd-cyan/30 text-nd-text-secondary hover:border-nd-cyan/60 hover:text-nd-text",
                  ].join(" ")}
                >
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
          </label>
          {role !== "" && (
            <div className="border border-nd-cyan/20 bg-nd-bg/40 rounded-terminal px-3 py-2 space-y-1">
              <p className="text-nd-text-secondary text-sm italic">
                “{ROLE_PHRASES[role]}”
              </p>
              <p className="text-nd-cyan text-xs font-data">
                Atributo primário:{" "}
                {ROLE_PRIMARY_ATTRIBUTES[role].map((k) => ATTRIBUTE_LABELS[k]).join(", ")}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Attributes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-nd-text-secondary text-xs uppercase tracking-wider font-data">
            Distribuição de atributos
          </span>
          <span
            className={`font-data text-sm ${remaining === 0 ? "text-nd-green" : "text-nd-gold"}`}
          >
            {remaining} ponto{remaining === 1 ? "" : "s"} restante{remaining === 1 ? "" : "s"}
          </span>
        </div>

        <div className="space-y-2">
          {ATTRIBUTE_KEYS.map((key) => {
            const atSoftCap = attributes[key] >= SOFT_CAP;
            const statColor = atSoftCap
              ? "text-nd-gold"
              : attributes[key] > BASE_ATTRIBUTES
                ? "text-nd-cyan"
                : "text-nd-text";
            const borderGlow = atSoftCap ? "border-nd-gold/40 shadow-neon-gold" : "border-nd-cyan/20";

            return (
              <div key={key} className="space-y-1">
                <div
                  className={`flex items-center justify-between bg-nd-bg/60 border ${borderGlow} rounded-terminal px-3 py-2 transition-colors`}
                >
                  <span className="text-nd-text text-sm w-28">{ATTRIBUTE_LABELS[key]}</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={!canDecrease(key)}
                      className="w-8 h-8 border border-nd-cyan/40 text-nd-cyan rounded-terminal hover:bg-nd-cyan/10 disabled:opacity-30 disabled:hover:bg-transparent"
                      aria-label="Diminuir"
                      onClick={() => adjust(key, -1)}
                    >
                      −
                    </button>
                    <span className={`font-data text-lg w-8 text-center tabular-nums ${statColor}`}>
                      {attributes[key]}
                    </span>
                    <button
                      type="button"
                      disabled={!canIncrease(key)}
                      className="w-8 h-8 border border-nd-cyan/40 text-nd-cyan rounded-terminal hover:bg-nd-cyan/10 disabled:opacity-30 disabled:hover:bg-transparent"
                      aria-label="Aumentar"
                      onClick={() => adjust(key, 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
                {atSoftCap && (
                  <p className="text-nd-gold/70 text-xs font-data pl-1">
                    Após {SOFT_CAP}, cada ponto custa 2
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-nd-text-secondary text-xs">
          Base {BASE_ATTRIBUTES} em cada atributo. Total: {spent}/{ATTR_TOTAL} pontos
          {softCapPenalty > 0 && (
            <span className="text-nd-gold">
              {" "}
              ({softCapPenalty} bônus de soft cap)
            </span>
          )}
          .
        </p>
      </div>

      <button
        type="submit"
        disabled={!valid || loading}
        className="btn-neon w-full disabled:opacity-50"
      >
        {loading ? "FORJANDO PERSONAGEM..." : "CRIAR PERSONAGEM"}
      </button>
    </form>
  );
}
