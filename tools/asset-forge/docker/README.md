# ComfyUI (asset-forge) — infraestrutura Docker

ComfyUI headless em Docker com GPU, usado pelo CLI
`tools/asset-forge/cli.mjs` para gerar assets do Neon Dusk (SD1.5).
**Nenhum peso/modelo entra no repo** — tudo fica no host via bind mount.

## Subir

```sh
cd tools/asset-forge/docker
docker compose up -d --build   # primeira build baixa ~3GB (torch cu126)
```

Depois de ~1 min, valide:

```sh
curl -s http://127.0.0.1:8188/system_stats   # deve responder comfyui_version
node tools/asset-forge/cli.mjs check          # exit 0 = checkpoint visível
```

## Onde ficam os modelos

O container monta no host:

| Caminho no host (padrão)                    | Montado em (container) |
| ------------------------------------------- | ---------------------- |
| `$HOME/comfy/ComfyUI/models` (setup Studio 21) | `/opt/ComfyUI/models`  |

O padrão pode ser sobrescrito:

```sh
COMFYUI_MODELS_DIR=/outra/pasta/models docker compose up -d
```

No host, o checkpoint `dreamshaper_8.safetensors` precisa estar em
`<models>/checkpoints/` (já presente no setup Studio 21).

## Como trocar de checkpoint

1. Coloque o `.safetensors` em `<models>/checkpoints/`.
2. Ajuste `CHECKPOINT` em `tools/asset-forge/src/workflow.mjs`.
3. `node tools/asset-forge/cli.mjs check` deve passar com o novo nome.

## Trocar a versão do ComfyUI

Edite a tag do clone no `Dockerfile` (`--branch v0.28.0`) e o `image:` no
`compose.yml`, então `docker compose up -d --build`. Fixe a versão para os
assets ficarem reproduzíveis (gate `baselines/neon-dusk.md`).

## Pré-requisitos do host

- Docker ≥ 27 + Compose ≥ v2.30 (suporte a `gpus:`)
- Driver NVIDIA ≥ 525 e `nvidia-container-toolkit` instalado
  (`docker info | grep -i nvidia` mostra o runtime)

## Parar / remover

```sh
docker compose down          # para o container (modelos permanecem no host)
```
