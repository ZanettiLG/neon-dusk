# Terminologia e IP

Inventário canônico de termos banidos e suas substituições por marca própria "São Paulo 2087". Documento-fonte para qualquer texto do produto: docs, lore, copy, UI, assets e prompts.

## Escopo da Regra

A regra de terminologia se aplica ao **produto inteiro** — documentação de produto, lore, copy, interface, assets visuais e prompts de geração. Um termo banido nunca convive com sua substituição no mesmo artefato.

## Tabela de Substituições

| Termo banido | Substituição | Justificativa lore |
|---|---|---|
| Kiroshi | **Óptica Vidraça** | Óptica feita do vidro da Paraíso — olho de vidro que enxerga através do concreto |
| Sandevistan | **OS Surto** | O surto de reflexo: o mundo congela e o corredor ainda anda |
| Berserk (OS) | **OS Fúria** | Fúria de combate; o ferro de Ogum no sistema |
| Gorilla Arms | **Braço de Ferro** | Ogum é o orixá do ferro — o chrome de força leva o nome do santo |
| Mantis Blades | **Navalha** | A navalha de rua: corta rápido, some mais rápido |
| Monowire | **Arame** | O arame da gambiarra — fino, invisível e mortal |
| MaxTac | **A Garra** | Unidade de elite do Grupo Falcão; o falcão tem garras |
| Trauma Team | **Resgate** | Serviço de seguro contra a morte; planos Prata, Ouro e Platina |
| Blackwall | **A Porteira** | Exu é o guardião das porteiras — a fronteira da Deep Net |
| Braindance | **Sintonia** | Sintonizar a fita dos outros; o risco é esquecer qual memória é sua |
| choom | **mano** | Gíria de rua paulistana que sobreviveu até 2087 |
| edgerunner(s) | **corredor(es)** | Quem vive o corre. Minúscula como termo comum; "Corredor" como tier (maiúscula) |
| Night City Legend | **Lenda de SP** | A lenda é da cidade — e a cidade é São Paulo |
| Johnny Silverhand | *(removido)* | Referência de tom removida; manter Neuromancer e Blade Runner |
| Afterlife (bar) | **drinks da Saideira** | A Saideira é o bar das lendas de SP 2087 |
| Animals / Tyger Claws | gangues próprias do setting | Usar as gangues documentadas em `02-mundo-e-universo.md` (ex: Anjos de Cromo, O Comando) |
| Street Cred | **Moral** (★ Moral) | Reputação de rua como moeda social: ter moral na quebrada é ter nome que abre porta — "sem moral, sem entrada, sem choro". Abreviação oficial: ★ Moral (em contexto de código curto: M) |
| ripperdoc | **Ferrageiro** | Ogum rege o ferro: quem instala chrome trabalha ferro no corpo. Ferrageiro é o ferreiro de gente — o ofício é abençoado pelo santo |
| Eddies / eddies / €$ | **Grana** (G$) | O dinheiro de rua se chama pelo nome da rua. Gíria paulistana que sobreviveu até 2087; símbolo oficial: G$ |
| cyberdeck | **Gazuá** | Gazuá é a chave-mestra do ladrão. Exu guarda as porteiras — o gazuá abre a porteira. Como slot de OS: **OS Gazuá** |
| Berserker (stim) | **Pancadão** | Fúria em ampola: o grave do funk no sangue. Pancadão é a ocupação sonora da quebrada — o grave que faz o container tremer |
| Roles | **Banca** | No jogo do bicho, a banca é a casa — no submundo 2087, a banca é teu papel na rua. Cada um joga na sua banca |
| Solo (classe) | **Bicho** | O bicho do jogo — o animal solto na rua que resolve na porrada |
| Netrunner (classe) | **Vulto** | Quem ninguém vê: só o vulto na Rede. O vulto atravessa a encruzilhada e some antes do olho registrar |
| Tech (classe) | **Gambiarrista** | Gambiarra não é defeito — é valor cultural. Quem conserta com o que tem e faz funcionar |
| Fixer (classe) | **Despachante** | Exu despacha pedido na encruzilhada; o despachante despacha gig na rua. Intermediário entre o corre e a grana |
| Nomad (classe) | **Estradeiro** | Ogum rege as estradas — quem vive na estrada é estradeiro |
| Medtech (classe) | **Socorrista** | O socorro que a rua tem: chega quando o Resgate não chega. Cobra barato e não faz pergunta |

## Regras de Naming

1. **Marca própria sempre** — todo equipamento, facção, sistema e serviço tem nome criado para Neon Dusk. Nunca reutilizar nomes de IP existente.
2. **Raiz paulistana** — nomes ancoram no imaginário de São Paulo: o vidro da Paraíso, o ferro de Ogum, as porteiras de Exu, o corre do motoboy.
3. **Tom de rua** — nomes curtos, diretos, que soam como gíria de submundo. Uma palavra quando possível; duas no máximo.
4. **Proibição total no produto** — termos banidos não aparecem em nenhum artefato do produto (docs, lore, copy, UI, assets, prompts). A lista banida é documentada aqui e em `../design/04-pipeline-ia-e-prompts.md`.
5. **Exceção apenas nominativa** — referências diretas a CP2077/RED (créditos, pesquisa, meta-docs) e negações ("não é Night City") são permitidas; nunca dentro de copy, UI ou lore diegético.

## Política de Código e Enums

A propagação dos renomes ao código (enums, colunas, chaves de API, labels) é da follow-up **#145**. Até lá:

- **Chaves internas mantidas** — enum values, nomes de coluna e chaves de API continuam com os tokens antigos (`street_cred`, `eddies`, `role: 'solo'` etc.). Nenhum rename de schema/API nesta rodada.
- **Labels trocados** — qualquer string visível ao jogador usa a terminologia nova (Moral, Grana, Banca, etc.).
- **Símbolos oficiais** — Grana usa **G$**; Moral usa **★ Moral** (abreviação curta em contexto de código: `M`). O símbolo antigo €$ não volta.

## Casos de Borda Mantidos

Termos genéricos do gênero cyberpunk que NÃO são substituídos:

- **chrome**, **gig**, **flatline**, **stim**, **crew**, **ICE**
- **Blackout 2075** (evento canônico do setting — mantido; "Blackwall" é banido e vira A Porteira)

## Nota de Crédito

Cyberpunk 2077 e Cyberpunk RED são marcas de seus respectivos detentores. Referências nominativas são permitidas apenas em meta-docs (créditos, pesquisa de mercado, ADRs, comparações de design) — nunca em artefatos do produto.

## Ferramenta de verificação

Guarda de consistência terminológica: `node scripts/check-terminologia.mjs` (exit 1 se um termo banido reaparecer nos docs; zero dependências).
