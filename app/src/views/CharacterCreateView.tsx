import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CreateCharacterRequest } from "@neon-dusk/shared";
import { ApiError } from "@/api/client";
import { useAuthStore } from "@/stores/auth";
import CharacterForm from "@/components/CharacterForm";

/** Character creation page: wraps CharacterForm, navigates on success (port of CharacterCreateView.vue). */
export default function CharacterCreateView() {
  const navigate = useNavigate();
  const auth = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  async function onSubmit(payload: CreateCharacterRequest): Promise<void> {
    setFormError(null);
    setNameError(null);
    setLoading(true);
    try {
      await auth.createCharacter(payload);
      navigate("/dashboard");
    } catch (err) {
      // NAME_TAKEN maps to the codinome field; everything else stays in the banner.
      if (err instanceof ApiError && err.code === "NAME_TAKEN") {
        setNameError(err.message);
      } else {
        setFormError(err instanceof Error ? err.message : "Falha na conexão");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center py-8">
      <div className="card w-full max-w-xl space-y-6">
        <div className="space-y-1">
          <h2 className="font-heading text-2xl text-nd-gold tracking-widest">MONTAR PERSONAGEM</h2>
          <p className="text-nd-text-secondary text-sm">
            Nome, origem, banca e o seu corte de atributos. Depois disso, não tem volta.
          </p>
        </div>

        {formError && (
          <p className="text-nd-magenta font-data text-sm border border-nd-magenta/30 rounded-terminal px-3 py-2">
            {formError}
          </p>
        )}

        <CharacterForm
          loading={loading}
          nameError={nameError}
          onNameChange={() => setNameError(null)}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
}
