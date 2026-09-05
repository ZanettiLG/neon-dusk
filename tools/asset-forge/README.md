# asset-forge

CLI de geração de assets por IA para o Neon Dusk — difusão SD1.5 via ComfyUI
headless local. Zero dependências (Node ≥ 22: `fetch`, `parseArgs`, `node:test`).

## Pré-requisitos

- **Node ≥ 22**
- **ComfyUI** rodando localmente (padrão `http://127.0.0.1:8188`; alterável via
  `--url` ou env `COMFYUI_URL`)
- Checkpoint **dreamshaper_8** instalado no ComfyUI (`models/checkpoints/`)

Valide o ambiente antes de gerar:

```
node tools/asset-forge/cli.mjs check
```

## Uso

```
node tools/asset-forge/cli.mjs list                        # tipos do registry
node tools/asset-forge/cli.mjs check                       # ComfyUI + checkpoint ok?
node tools/asset-forge/cli.mjs generate body-map --variants 3
node tools/asset-forge/cli.mjs generate body-map --seed 482913 --dry-run
```

Flags de `generate`: `--variants N` (default 1), `--seed S` (reprodutível; com
N variantes usa S, S+1, …), `--out DIR` (sobrescreve o destino do registry),
`--url URL`, `--timeout S` (default 120s), `--dry-run` (imprime o workflow sem
submeter).

Exit codes: `0` ok · `1` erro inesperado · `2` uso/registry inválido ·
`3` ComfyUI offline · `4` falha de geração · `5` timeout.

## Fluxo de aceite (gate humano)

1. Gere N variantes (`--variants N`) — arquivos `<tipo>-<seed>.png` no destino
   do registry (`registry.json` → `output.dir`).
2. Critique cada variante contra `baselines/neon-dusk.md` (critérios + red
   flags + paleta) e escolha a melhor.
3. **Pós-processe** a escolhida (body-map): `rembg` em venv dev-only (ex.:
   `python3 -m venv /tmp/rembg-venv && /tmp/rembg-venv/bin/pip install "rembg[cpu]"`)
   → matte com erode ~2px + feather ~1px (sem halo) → composição sobre fundo
   `#0a0a0a` opaco. O gate de fundo uniforme vale para o **asset final**
   pós-processado, não para o PNG bruto.
4. Renomeie **a única variante aceita** para o nome canônico
   (`output.filename`, ex.: `body-map.png`) e commite.
5. **Delete as variantes rejeitadas** — só o asset aceito entra no repo.
6. Se nenhuma passar, ajuste prompt/seed e regenere. Nunca commite "quase".

## Convenções

- Modelos, pesos e variantes rejeitadas ficam **fora do repo** (cache do
  ComfyUI); no repo vão só código, `registry.json`, prompts e o asset aceito.
- `registry.json` é a fonte única de estilo e prompts (bloco `style` + 4
  tipos). As coordenadas de interação (hit-areas de UI) moram no app
  (`app/src/lib/chrome-body-map.ts`), não aqui.
- Testes: `node --test test/` (fetch stub, zero rede).
