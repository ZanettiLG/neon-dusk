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

## Lista de Stims (Copy para UI)

| Stim | Descrição diegética |
|---|---|
| Syn-café | "Cafeína sintética de grau farmacêutico. Legal. Barata. Essencial." |
| Reflex | "Overclock do sistema nervoso. 15% mais rápido. Depois o tremor vem." |
| AdrenaStim | "Adrenalina em cartucho. Força bruta agora. Exaustão depois." |
| Cortex+ | "Boost de processamento neural. Firewall? Que firewall?" |
| Ghost | "Camuflagem química. Ninguém te vê. Nem você se vê direito." |
| Berserker | "Fúria em ampola. Destrói tudo. Depois não lembra de nada." |
| Glitter | "Cristal dos Tyger Claws. Brilha. Vicía. Mata devagar." |
| Black Lace | "A lenda. O último recurso. O último erro." |
