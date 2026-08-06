---
name: cyberpunk-lore
description: Cyberpunk universe reference for UI and narrative writing. Provides vocabulary, tone of voice, and references for writing copy, UI text, and diegetic descriptions. Use when writing UI text, item descriptions, implant flavor, district descriptions, or fixer dialogue.
license: MIT
compatibility: opencode
metadata:
  audience: agents
  domain: narrative-design
---

# Cyberpunk Lore — Referência de Universo para UI e Narrativa

Skill de lore cyberpunk. Vocabulário, tom de voz, referências para escrever copy, UI e descrições diegéticas.

## Quando Carregar
- Escrevendo texto de UI (mensagens, labels, placeholders)
- Criando descrições de itens, implantes, distritos
- Gerando diálogos de fixers
- Carregada por: `developer` (quando escrevendo copy), `game-logic-dev`

## Glossário Cyberpunk

| Termo | Significado | Uso |
|---|---|---|
| **Chrome** | Cyberware, implantes cibernéticos | "Gorilla Arms: chrome militar de 3ª geração" |
| **Eddies** (€$) | Eurodollars, moeda | "O fixer pagou 5.000 eddies. Limpos." |
| **Fixer** | Intermediário de missões | "Cupim tem um gig para você." |
| **Gig** | Missão, trabalho | "Gig disponível: extração em O Fervo" |
| **Flatline** | Morrer | "Mais um que flatlineou no Grid." |
| **Ripperdoc** | Médico de chrome ilegal | "Conheço um ripperdoc na Quebrada." |
| **Netrunner** | Hacker | "Precisa de um netrunner para esse servidor." |
| **ICE** | Intrusion Countermeasures Electronics | "O servidor tem ICE camada 3." |
| **Street Cred** | Reputação de rua | "Com esse cred, até a Carcará te atende." |
| **Stim** | Estimulante/droga | "AdrenaStim: +30 NIL. Burnout depois." |
| **Crew** | Equipe/gangue | "Sua crew controla O Fervo esta semana." |
| **A Saideira** | Bar das lendas | "Te vejo na Saideira. Se sobreviver." |

## Glossário de Rua SP

Vocabulário da São Paulo periférica que sobreviveu até 2087. Uso obrigatório em falas de fixer, NPCs de rua e descrições ambientais da Quebrada e do Fervo.

| Gíria | Significado | Uso diegético |
|---|---|---|
| **mano** | Irmão, parceiro; jovem da periferia | "Salve, mano. O Cupim mandou." |
| **quebrada / a Quebrada** | Bairro periférico, o hood | "A Quebrada não dorme. A Quebrada observa." |
| **corre / correria** | A luta diária, o esquema de sobrevivência | "O corre não para. Nunca parou." |
| **fita** | Situação, assunto | "Qual é a fita? Tá estranho no Fervo hoje." |
| **bagulho** | Coisa, mercadoria (geralmente ilícita) | "Passa o bagulho. Rápido. Gambé na esquina." |
| **playba / boy** | Rico mimado, corporativo. Pejorativo | "Playba nenhum pisa aqui. O chão afunda." |
| **vacilão** | Quem vacila, otário | "Vacilou, dançou. A rua não perdoa." |
| **firmeza** | Conformidade, paz | "Firmeza total. Tudo nos conforme." |
| **é nóis** | "Somos nós, juntos." Selo de pacto | "Fechou o trampo? É nóis, então." |
| **salve** | Saudação, shout-out | "Manda um salve pra quebrada." |
| **vida loka** | Ethos de sobrevivência na margem. Orgulho e fatalismo | "Vida loka, mano. Até o fim." |
| **malandro** | Esperto, vivente da rua. Ambigo: elogio ou acusação | "Cupim é malandro. Mas é dos nossos." |
| **treta** | Briga, rolo, conflito | "Treta feia no Fervo ontem. Três flatline." |
| **gambé** | Polícia, PM. Hostil | "Corre que os gambé vem. Corre." |
| **demorô** | "Fechado, combinado." Selo de pacto | "Demorô. Tamo junto nessa fita." |
| **tá ligado** | "Entendeu?" / "Tô junto." Marcador de pacto | "O bagulho é sinistro, tá ligado?" |
| **papo reto** | Conversa séria, sem enrolação | "Papo reto: cê vai ou não vai?" |
| **humilde** | Elogio anti-playba: da quebrada e não se acha | "Mó humilde, o mano. Raiz." |
| **mó** | Intensificador: "maior" | "Fiquei na mó neurose com essa gig." |
| **gambiarra** | Solução criativa e improvisada. NÃO é defeito — é valor cultural | "Essa ponte de cabo? Gambiarra pura. Aguentou 30 ano. Vai aguentar mais." |

## Tom de Voz

### Princípios
1. **Noir sujo**: frases curtas, irônicas, sem glamour
2. **Estilo Gibson**: descrições sensoriais, jargão que o leitor infere
3. **Nunca corporativo**: sem "solution", "leverage", "synergy"
4. **Nunca heróico**: sem "save the world", "hero", "chosen one"

### Exemplos por Contexto

**Sucesso em gig**:
- ✅ "O fixer pagou. Você entregou. Ninguém morreu. Hoje foi um bom dia."
- ❌ "Congratulations! You completed the mission successfully!"

**Falha em gig**:
- ✅ "O alarme disparou. Você correu. Metade dos eddies ficou para trás. Mas você ainda está respirando."
- ❌ "Mission failed. Please try again."

**Morte (flatline)**:
- ✅ "Seu nome era [Nome]. Agora é só mais uma entrada nos arquivos da Trauma Team."
- ❌ "You died. Respawning in 3... 2... 1..."

**Level up / Chrome instalado**:
- ✅ "O ripperdoc terminou. Você sente o chrome se fundir aos nervos. Algo dentro de você ficou mais forte. Algo dentro de você se foi."
- ❌ "Chrome installed! +10 Body."

**Street Cred up**:
- ✅ "Alguém sussurrou seu nome na Saideira. Não muito alto. Mas sussurrou."
- ❌ "Street Cred increased to 25!"

### O Que NUNCA Fazer
- Emojis em mensagens de sistema
- Linguagem corporativa ("utilize our services")
- Infantilização ("good job, choom!")
- Exposição desnecessária (explique o mínimo; o jogador infere)

## Religiosidade de SP

Sincretismo afro-brasileiro e fé popular. Onipresente no cotidiano de 2087 — das oferendas nos becos aos amuletos no painel do carro. Toda gig tem seu santo.

| Elemento | Domínio 2087 | Gancho narrativo |
|---|---|---|
| **Exu** — orixá da comunicação, encruzilhadas, mensageiro. Saudação: "Laroiê!". Cores: vermelho/preto. Guardião das porteiras (Baraqueto), senhor do mercado (Olojá) | Netrunners, gateways, backdoors | Todo hacker serve Exu antes da gig — oferenda de abertura é obrigatória, sob pena de crash. "Guardião das porteiras" = guardião dos backdoors. Vermelho e preto nos decks |
| **Ogum** — orixá do ferro, guerra, **tecnologia**, estradas. Sincretizado com São Jorge no Sudeste. "Jura-se beijando ferro" | Chrome, armas, asfalto, comboios | O santo do chrome e do asfalto. Amuleto de Ogum no painel vale mais que airbag. Feijoada de Ogum (abril) = refeição ritual pós-gig |
| **Pomba Gira** — entidade feminina da encruzilhada. Champanhe, cigarro, risada. Dama da noite. "Rainha das 7 Encruzilhadas" | Ciber-bordéis, dona da noite digital, amarração de contratos | A "Mãe" de terreiro que é rainha da informação do submundo. Risada alta + champanhe = senha de acesso |
| **Preto Velho** — entidade de sabedoria e cura. Benze com arruda, reza com terço, fuma cachimbo. "Vovó Maria Conga", "Pai João" | Ripperdoc ancião, data-curandeiro | Benze antes de operar, cobra em "trabalho pra casa". Baforada de cachimbo = anestésico herbal + limpeza de biosig |
| **Zé Pelintra** — malandro sagrado do Catimbó. Terno de linho branco, sapatos bicolor, chapéu panamá, bengala. Cerveja clara, cigarro, baralho. "Advogado dos Pobres" | Fixer, golpista carismático, cassino | Terno de linho anti-bala. Todo acerto se fecha com cerveja clara. Nunca se recusa uma |
| **Vela de santo / terço / arruda** | Objetos do cotidiano | Vela de santo no painel do carro. Terço pendurado no retrovisor. Galho de arruda atrás da orelha. Sal grosso na porta do bar |

## Comida de Rua SP

Comida é identidade. Essas referências devem aparecer em descrições ambientais do Fervo e interações de rua.

| Comida | O que é | Em 2087 |
|---|---|---|
| **Pastel de feira + caldo de cana** | O par sagrado paulistano | Pastel de proteína sintética, caldo de cana geneticamente otimizada. Continua sagrado |
| **Dogão** | Cachorro-quente completo (purê, batata palha, milho, ervilha, catupiry) | 24h. Combustível de edgerunner e motoboy. "Dogão do seu Zé: 30 anos no mesmo ponto, sobreviveu a 3 desastres corporativos" |
| **Marmita de bandejão** | Arroz, feijão, "mistura" (proteína), farinha | Comida do trabalhador do Fervo. O bandejão virou franquia de sobrevivência |
| **Arroz com feijão** | A base da mesa brasileira | "Enquanto tiver arroz com feijão no prato, tá tudo certo." Mantra da resiliência |
| **Café** | Preto, sem açúcar, copo americano | Onipresente. Toda negociação começa com um café. "Café primeiro, negócio depois" |

## Música como Território

Música em SP não é entretenimento — é marcador de território. O som que toca define quem controla o quarteirão.

| Gênero | Significado territorial | Referência diegética |
|---|---|---|
| **Funk** (paulista e carioca) | Pancadão = ocupação sonora da quebrada | "O grave do funk faz os container tremer. Quem controla o som, controla a rua." |
| **Racionais MC's** | A Bíblia de SP. "Diário de um Detento" como documento fundador | Mano Brown como profeta. "Aqui não tem herói, aqui só tem sobrevivente." Citado em pichações, tatuagens, altares de rua |
| **Samba-rock** | SP original. Fusão de samba com soul/funk americano | Jorge Ben, Tim Maia, Clube do Balanço. Trilha da Augusta/Fluxo. Os bares chiques tocam samba-rock |
| **Forró e sertanejo** | Música do migrante nordestino que veio "tentar a vida em SP" | Presente no Fervo e na Quebrada. Sanfona sampleada em synth. "Veio do Norte e nunca mais voltou" |

## Maneirismos — O Loop da Rua

Toda interação de rua segue este padrão de três batidas. Use em diálogos de fixer, NPCs da Quebrada e saudações de bar.

1. **Vocativo** — "E aí, mano." "Salve, truta." "Ô, chefe."
2. **Status** — "Firmeza?" "Tudo em paz?" "Como tá o corre?"
3. **Pacto** — "Tá ligado." "Demorô." "É nóis." "Fechou."

Exemplo de diálogo de fixer:
> "Salve, mano. Firmeza? Então... o Cupim tem uma fita pra você. Extração limpa, pagamento em eddies. Papo reto: é trampo pra quem tem coragem. Demorô?"

## Lista de Stims (Copy para UI)

| Stim | Descrição diegética |
|---|---|
| Syn-café | "Cafeína sintética de grau farmacêutico. Legal. Barata. Essencial." |
| Reflex | "Overclock do sistema nervoso. 15% mais rápido. Depois o tremor vem." |
| AdrenaStim | "Adrenalina em cartucho. Força bruta agora. Exaustão depois." |
| Cortex+ | "Boost de processamento neural. Firewall? Que firewall?" |
| Ghost | "Camuflagem química. Ninguém te vê. Nem você se vê direito." |
| Berserker | "Fúria em ampola. Destrói tudo. Depois não lembra de nada." |
| Glitter | "Cristal sintético do submundo. Brilha. Vicía. Mata devagar." |
| Black Lace | "A lenda. O último recurso. O último erro." |
