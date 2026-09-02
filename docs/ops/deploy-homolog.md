# Deploy release-gated (homolog → latest) — Neon Dusk

> Fluxo de deploy em duas etapas: `main` nunca deploya; staging (branch
> `homolog`) valida a imagem candidata; `latest` só avança após o staging
> passar. Workflow: `.github/workflows/homolog-deploy.yml`.

## Fluxo

1. **Features mergem em `main` sem build/deploy.** Nenhum workflow reage a
   pushes em `main`; a integração contínua é apenas a review + testes locais.
2. **Promoção:** o usuário faz merge `main → homolog` e push. Isso dispara o
   workflow `homolog-deploy` — o ÚNICO trigger de build/deploy do repo.
3. **Workflow** (`build-and-deploy`, ubuntu-latest, timeout 45min):
   - `docker/build-push-action` faz buildx + push das tags **candidatas**
     `ghcr.io/zan-ia/neon-dusk-server:homolog` e `...-app:homolog`
     (cache `type=gha`).
   - SSH na VPS staging: `git fetch/checkout/pull homolog` em `/opt/neon-dusk`
     e executa `./scripts/deploy-staging.sh` — que delega ao
     `deploy-prod.sh` com `IMAGE_TAG=homolog`: migrate antes do `up -d`,
     smoke test (`/` e `/api/health`) e rollback automático em falha.
   - Promoção: SE o deploy de staging passou, `docker buildx imagetools create`
     promove `homolog → latest` para server e app. `latest` é um alias da
     imagem homolog, nunca um build separado.
4. **Produção:** passo manual do usuário na VPS de produção:
   `ssh vps && cd /opt/neon-dusk && git pull && ./scripts/deploy-prod.sh`
   (default `IMAGE_TAG=latest`), que puxa a imagem promovida.
5. **Setup one-time da VPS staging:**
   - checkout do repo em `/opt/neon-dusk` na branch `homolog`;
   - `.env.production` com valores de staging (o mesmo nome do arquivo de
     produção — o `deploy-prod.sh` exige `.env.production` no CWD);
   - docker instalado (compose v2);
   - chave SSH pública do deployer em `~/.ssh/authorized_keys`;
   - porta 80 livre (`ss -ltnp`).
6. **Secrets do workflow:** `STAGING_SSH_KEY`, `STAGING_HOST`, `STAGING_USER`,
   `STAGING_PORT` (opcional; default 22). Fallback: se o GHCR responder 403 com
   `GITHUB_TOKEN`, usar um `CR_PAT` (PAT com scope `write:packages`) no login.
7. **Rollback:** migrate falho → deploy de staging aborta (`set -e`), staging
   mantém a imagem anterior e `latest` NÃO avança (produção intacta). Corrigir a
   migration e redeployar (forward-only) — ver `docs/ops/rollback.md`.

## Por que release-gated

- **`main` não é um contrato de deploy** — código verde em CI não é código em
  produção; a promoção é um ato humano explícito.
- **`latest` é imutável por padrão:** uma imagem candidata só vira `latest`
  depois de passar pelo deploy+smoke real em staging.
- **Falha de migrate não contamina produção:** o workflow falha no step de
  staging e a promoção é pulada — sem sequência manual de rollback urgente.