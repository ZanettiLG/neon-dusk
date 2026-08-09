import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CharacterCreateView from "@/views/CharacterCreateView";
import { useAuthStore } from "@/stores/auth";
import type { Character } from "@neon-dusk/shared";

const mocks = vi.hoisted(() => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  setAccessToken: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  api: mocks.api,
  setAccessToken: mocks.setAccessToken,
  ApiError: class extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

const character: Character = {
  id: "c1",
  userId: "u1",
  name: "Ghost",
  origin: "a_paraiso",
  role: "netrunner",
  body: 10,
  reflexes: 3,
  intelligence: 3,
  technical: 3,
  cool: 3,
  streetCred: 0,
  maxStreetCredAchieved: 0,
  ability: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderCreate() {
  return render(
    <MemoryRouter initialEntries={["/create-character"]}>
      <Routes>
        <Route path="/create-character" element={<CharacterCreateView />} />
        <Route path="/dashboard" element={<div>DASHBOARD PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

// Fill a valid form: name + origin + role + 7 free attribute points (22 total).
async function fillValidForm() {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText("Ex.: Cobra, Ghost, Viper"), "Ghost");
  await user.selectOptions(screen.getByRole("combobox"), "a_paraiso");
  // ponytail: the "Role" label wraps all 5 role buttons, so the first one
  // (Solo) inherits the whole label as accessible name — click "Netrunner".
  await user.click(screen.getByRole("button", { name: "Netrunner" }));
  const increase = screen.getAllByRole("button", { name: "Aumentar" });
  for (let i = 0; i < 7; i++) {
    await user.click(increase[0]);
  }
}

describe("CharacterCreateView", () => {
  beforeEach(() => {
    useAuthStore.setState(useAuthStore.getInitialState());
    mocks.api.post.mockReset();
  });

  it("should keep the submit button disabled until the form is valid", () => {
    renderCreate();

    expect(
      screen.getByRole("button", { name: "CRIAR PERSONAGEM" }),
    ).toBeDisabled();
  });

  it("should create the character and navigate to the dashboard on success", async () => {
    mocks.api.post.mockResolvedValue(character);
    renderCreate();

    await fillValidForm();

    const submit = screen.getByRole("button", { name: "CRIAR PERSONAGEM" });
    expect(submit).toBeEnabled();
    await userEvent.setup().click(submit);

    expect(await screen.findByText("DASHBOARD PAGE")).toBeInTheDocument();
    expect(useAuthStore.getState().character).toEqual(character);
    expect(mocks.api.post).toHaveBeenCalledWith(
      "/api/characters",
      expect.objectContaining({
        name: "Ghost",
        origin: "a_paraiso",
        role: "netrunner",
        attributes: expect.objectContaining({ body: 10 }),
      }),
    );
  });

  it("should show an error banner and stay on the page when creation fails", async () => {
    mocks.api.post.mockRejectedValue(new Error("Codinome já em uso"));
    renderCreate();

    await fillValidForm();

    await userEvent.setup().click(
      screen.getByRole("button", { name: "CRIAR PERSONAGEM" }),
    );

    expect(await screen.findByText("Codinome já em uso")).toBeInTheDocument();
    expect(screen.queryByText("DASHBOARD PAGE")).not.toBeInTheDocument();
    expect(useAuthStore.getState().character).toBeNull();
  });

  it("soft cap indicator is not shown when no stat reaches 15", async () => {
    renderCreate();
    // With 7 free points (max 10 on one stat), soft cap text should not appear.
    await fillValidForm();
    // Wait for the increase buttons to be clicked and DOM to settle.
    expect(screen.queryByText(/Após 15, cada ponto custa 2/)).not.toBeInTheDocument();
    expect(screen.queryByText(/bônus de soft cap/)).not.toBeInTheDocument();
  });

  it("remaining points reflect initial 7-pool correctly", () => {
    renderCreate();
    expect(screen.getByText("7 pontos restantes")).toBeInTheDocument();
  });
});
