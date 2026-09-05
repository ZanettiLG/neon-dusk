// Neon Dusk — Trampo Template Seeds (ND-054 Data Seeding)
// ============================================================================
// 19 hand-crafted trampo templates spanning T1-T5 (6 × T1, 4 × T2, 3 × T3,
// 3 × T4, 3 × T5). The T3-T5 tiers were added in the T3-T5 progression pass
// (PR #111, closes #110) with SC gates 15/30/50 — see 03-mecanicas-core.md §2.
// Types: 7 extraction, 6 delivery, 6 sabotage.
// Districts spread across: O Fluxo, A Paraíso, O Fervo, A Quebrada, Babilônia,
// As Mortas, O Ponto.
//
// Balance anchors (03-mecanicas-core.md §2, 04-sistemas-e-progressao.md §5):
//   T1 payout 500-2.000, NIL 10-15, difficulty 14-36, SC 0
//   T2 payout 2.000-8.000, NIL 15-25, difficulty 60-75, SC 5
//   T3 payout 8.000-30.000, NIL 25-40, difficulty 60-70, SC 15
//   T4 payout 30.000-100.000, NIL 35-42, difficulty 75-85, SC 30
//   T5 payout 100.000+, NIL 50-60, difficulty 90-100, SC 50
//   requiredStats achievable by optimized starting chars (max 8 T1, max 10 T2)
//
// cooldownSeconds is NOT included — the seed script derives it per tier
// (T1=5, T2=60, T3=900, T4=7200, T5=86400, per #187 progression).

/** Static seed data for a trampo template. */
export interface GigTemplateSeed {
  name: string;
  description: string;
  tier: "t1" | "t2" | "t3" | "t4" | "t5";
  type: "extraction" | "delivery" | "sabotage";
  district: string;
  difficulty: number;
  escapeDifficulty: number;
  requiredStats: Record<string, number>;
  requiredStreetCred: number;
  baseReward: number;
  nilCost: number;
  heatGenerated: number;
  legworkMinutes: number;
}

export const GIG_TEMPLATES: GigTemplateSeed[] = [
  // ═══ T1 — Bico (SC 0+) ═══════════════════════════════════════════

  {
    name: "Encomenda Extraviada",
    description:
      "Um pacote caiu do drone de entrega da Concreta no telhado do bloco 7. " +
      "Os Filhos do Fluxo já estão farejando. Pega antes deles e entrega no ponto cego.",
    tier: "t1",
    type: "extraction",
    district: "O Fluxo",
    difficulty: 24,
    escapeDifficulty: 22,
    requiredStats: { body: 4 },
    requiredStreetCred: 0,
    baseReward: 800,
    nilCost: 12,
    heatGenerated: 15,
    legworkMinutes: 10,
  },
  {
    name: "Mula Noturna",
    description:
      "Leva este datachip através de 3 postos de controle da Polícia Corporativa " +
      "sem ser escaneado. Se te pararem, engole o chip. Sim, é sério.",
    tier: "t1",
    type: "delivery",
    district: "A Paraíso",
    difficulty: 28,
    escapeDifficulty: 28,
    requiredStats: { reflexes: 5, cool: 3 },
    requiredStreetCred: 0,
    baseReward: 1000,
    nilCost: 12,
    heatGenerated: 10,
    legworkMinutes: 15,
  },
  {
    name: "Curto-Circuito",
    description:
      "Os geradores do setor 4 precisam parar por exatamente 37 minutos. " +
      "Nem 36, nem 38. O sindicato quer mandar um recado e você é o mensageiro.",
    tier: "t1",
    type: "sabotage",
    district: "O Fervo",
    difficulty: 32,
    escapeDifficulty: 32,
    requiredStats: { technical: 5 },
    requiredStreetCred: 0,
    baseReward: 1200,
    nilCost: 14,
    heatGenerated: 20,
    legworkMinutes: 10,
  },
  {
    name: "Limpeza de Garagem",
    description:
      "Tem um Kadokami blindado estacionado no subsolo do shopping abandonado. " +
      "O dono virou carne moída na guerra de gangues. O carro é seu — se conseguir ligar ele.",
    tier: "t1",
    type: "extraction",
    district: "A Quebrada",
    difficulty: 36,
    escapeDifficulty: 36,
    requiredStats: { technical: 4, reflexes: 4 },
    requiredStreetCred: 0,
    baseReward: 1500,
    nilCost: 15,
    heatGenerated: 25,
    legworkMinutes: 15,
  },
  {
    name: "Corre da Farmácia",
    description:
      "O estoque de imunossupressores do beco 3 acabou e o próximo carregamento " +
      "só chega sexta. Leva esta caixa térmica até a clínica clandestina antes que alguém morra.",
    tier: "t1",
    type: "delivery",
    district: "Babilônia",
    difficulty: 14,
    escapeDifficulty: 18,
    requiredStats: { cool: 3 },
    requiredStreetCred: 0,
    baseReward: 500,
    nilCost: 10,
    heatGenerated: 5,
    legworkMinutes: 5,
  },
  {
    name: "Sucata Premiada",
    description:
      "Uma torre de servidor pré-Blackout foi localizada no ferro-velho do Alemão. " +
      "Os Saqueadores de Sucata já montaram guarda. Destrói a torre antes que extraiam os dados.",
    tier: "t1",
    type: "sabotage",
    district: "A Quebrada",
    difficulty: 20,
    escapeDifficulty: 25,
    requiredStats: { technical: 3, body: 3 },
    requiredStreetCred: 0,
    baseReward: 900,
    nilCost: 11,
    heatGenerated: 10,
    legworkMinutes: 10,
  },

  // ═══ T2 — Corre (SC 5+) ═════════════════════════════════════════════════

  {
    name: "Bagre Ensaboado",
    description:
      "Um engenheiro da Concreta quer desertar. O problema: ele está trancado " +
      "no laboratório 9 com lockdown biométrico ativo. Extrai ele antes que a segurança interna resolva o bug.",
    tier: "t2",
    type: "extraction",
    district: "A Paraíso",
    difficulty: 60,
    escapeDifficulty: 55,
    requiredStats: { body: 6, technical: 5 },
    requiredStreetCred: 5,
    baseReward: 3500,
    nilCost: 18,
    heatGenerated: 30,
    legworkMinutes: 20,
  },
  {
    name: "Linha Vermelha",
    description:
      "Transporta um carregamento de neuroestimulantes militares do Fervo até " +
      "o Ponto sem passar por nenhuma câmera da Polícia Corp. O trajeto tem 14 câmeras. Boa sorte.",
    tier: "t2",
    type: "delivery",
    district: "O Fervo",
    difficulty: 65,
    escapeDifficulty: 60,
    requiredStats: { reflexes: 7, cool: 5 },
    requiredStreetCred: 5,
    baseReward: 4000,
    nilCost: 20,
    heatGenerated: 35,
    legworkMinutes: 25,
  },
  {
    name: "Protocolo Cinzas",
    description:
      "A Aço Paulista está transferindo dados de projeto para um servidor offline. " +
      "Planta um vírus corrosivo na subnet de backup. Quando tentarem restaurar, não vai ter o que restaurar.",
    tier: "t2",
    type: "sabotage",
    district: "O Fluxo",
    difficulty: 70,
    escapeDifficulty: 65,
    requiredStats: { technical: 7, intelligence: 6 },
    requiredStreetCred: 5,
    baseReward: 5000,
    nilCost: 22,
    heatGenerated: 40,
    legworkMinutes: 30,
  },
  {
    name: "Olho por Olho",
    description:
      "O despachante Carcará quer um protótipo de retina sintética que está num " +
      "cofre biométrico no 47° andar da Torre Falcão. O cofre só abre com um olho vivo. Adivinha de quem?",
    tier: "t2",
    type: "extraction",
    district: "Babilônia",
    difficulty: 75,
    escapeDifficulty: 70,
    requiredStats: { body: 8, cool: 6, technical: 5 },
    requiredStreetCred: 5,
    baseReward: 6000,
    nilCost: 25,
    heatGenerated: 50,
    legworkMinutes: 30,
  },

  // ═══ T3 — Esquema (SC 15+) ═══════════════════════════════════════════════

  {
    name: "Fantasma no Sistema",
    description:
      "Os servidores do Instituto Paraíso estão blindados. Plante o vírus " +
      "antes que o ICE adaptativo detecte sua presença.",
    tier: "t3",
    type: "sabotage",
    district: "A Paraíso",
    difficulty: 65,
    escapeDifficulty: 60,
    requiredStats: { technical: 10, intelligence: 8 },
    requiredStreetCred: 15,
    baseReward: 12000,
    nilCost: 28,
    heatGenerated: 40,
    legworkMinutes: 20,
  },
  {
    name: "Transplante Corporativo",
    description:
      "Um engenheiro da Aço Paulista quer sair. Extraia ele do complexo " +
      "industrial antes que a segurança perceba.",
    tier: "t3",
    type: "extraction",
    district: "O Fervo",
    difficulty: 70,
    escapeDifficulty: 65,
    requiredStats: { body: 10, reflexes: 8 },
    requiredStreetCred: 15,
    baseReward: 15000,
    nilCost: 30,
    heatGenerated: 45,
    legworkMinutes: 25,
  },
  {
    name: "Rota do Deserto",
    description:
      "Transporte um carregamento de cromo ilegal pelas rotas do deserto. " +
      "As milícias de fronteira estão com scanners novos.",
    tier: "t3",
    type: "delivery",
    district: "Babilônia",
    difficulty: 60,
    escapeDifficulty: 55,
    requiredStats: { reflexes: 9, cool: 7 },
    requiredStreetCred: 15,
    baseReward: 8000,
    nilCost: 25,
    heatGenerated: 20,
    legworkMinutes: 15,
  },

  // ═══ T4 — Golpe (SC 30+) ══════════════════════════════════════════════════

  {
    name: "Cofre Blindado",
    description:
      "O cofre subterrâneo da Concreta guarda protótipos militares. Abra ele " +
      "antes que o lockdown do distrito seja ativado.",
    tier: "t4",
    type: "extraction",
    district: "O Fluxo",
    difficulty: 80,
    escapeDifficulty: 75,
    requiredStats: { body: 13, technical: 10 },
    requiredStreetCred: 30,
    baseReward: 40000,
    nilCost: 38,
    heatGenerated: 60,
    legworkMinutes: 25,
  },
  {
    name: "Protocolo Zero",
    description:
      "Desative a grade de defesa automatizada do complexo. Se o protocolo " +
      "zero for ativado, nada sai vivo.",
    tier: "t4",
    type: "sabotage",
    district: "A Quebrada",
    difficulty: 85,
    escapeDifficulty: 80,
    requiredStats: { technical: 14, intelligence: 11 },
    requiredStreetCred: 30,
    baseReward: 55000,
    nilCost: 42,
    heatGenerated: 70,
    legworkMinutes: 30,
  },
  {
    name: "Última Milha",
    description:
      "Entregue o pacote no último andar da torre abandonada. Não olhe " +
      "dentro. Não faça perguntas.",
    tier: "t4",
    type: "delivery",
    district: "As Mortas",
    difficulty: 75,
    escapeDifficulty: 70,
    requiredStats: { reflexes: 12, cool: 10 },
    requiredStreetCred: 30,
    baseReward: 30000,
    nilCost: 35,
    heatGenerated: 35,
    legworkMinutes: 20,
  },

  // ═══ T5 — Golpe Mestre (SC 50+) ═════════════════════════════════════════════

  {
    name: "Inimigo do Estado",
    description:
      "Um whistleblower corporativo está escondido na zona mais vigiada da " +
      "cidade. Extraia ele antes que a Garra chegue.",
    tier: "t5",
    type: "extraction",
    district: "O Ponto",
    difficulty: 95,
    escapeDifficulty: 90,
    requiredStats: { body: 17, cool: 14 },
    requiredStreetCred: 50,
    baseReward: 120000,
    nilCost: 55,
    heatGenerated: 90,
    legworkMinutes: 30,
  },
  {
    name: "Apocalipse Programado",
    description:
      "O mainframe central controla todas as defesas do distrito. Plante o " +
      "worm e assista o paraíso queimar.",
    tier: "t5",
    type: "sabotage",
    district: "A Paraíso",
    difficulty: 100,
    escapeDifficulty: 95,
    requiredStats: { technical: 18, intelligence: 16 },
    requiredStreetCred: 50,
    baseReward: 150000,
    nilCost: 60,
    heatGenerated: 100,
    legworkMinutes: 30,
  },
  {
    name: "Herança Nuclear",
    description:
      "Transporte o núcleo de fusão portátil através do território " +
      "radioativo. A radiação é o menor dos seus problemas.",
    tier: "t5",
    type: "delivery",
    district: "As Mortas",
    difficulty: 90,
    escapeDifficulty: 85,
    requiredStats: { reflexes: 16, cool: 15 },
    requiredStreetCred: 50,
    baseReward: 100000,
    nilCost: 50,
    heatGenerated: 60,
    legworkMinutes: 25,
  },
];
