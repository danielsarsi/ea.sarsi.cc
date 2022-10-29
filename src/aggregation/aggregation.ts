import {
  END_POLLING,
  FIRST_ROUND_PERCENTAGE_VALID_VOTES,
  FIRST_ROUND_TOTAL_ABSTENTIONS,
} from "../constants.ts";

export interface AggregationRaw {
  ele: string;
  /** Abrangência (`BR`, `UF` ou `MU`). */
  tpabr: string;
  /** Código de abrangência. */
  cdabr: string;
  carper: string;
  /** Matematicamente definida. */
  md: string;
  t: string;
  f: string;
  /** Data de totalização. */
  dg: `${number}/${number}/${number}`;
  /** Hora de totalização. */
  hg: `${number}:${number}:${number}`;
  dt: string;
  ht: string;
  dv: string;
  /** Totalização final. */
  tf: string;
  /** Número de vagas. */
  v: string;
  esae: string;
  mnae: string;
  /** Número de seções. */
  s: string;
  /** Número de seções totalizadas. */
  st: string;
  /** Porcentagem de seções totalizadas. */
  pst: string;
  /** Número de seções não totalizadas. */
  snt: string;
  /** Porcentagem de seções não totalizadas. */
  psnt: string;
  /** Seções instaladas. */
  si: string;
  /** Porcentagem de seções instaladas. */
  psi: string;
  /** Seções não instaladas. */
  sni: string;
  /** Porcentagem de seções não instaladas. */
  psni: string;
  /** Seções apuradas. */
  sa: string;
  /** Porcentagem de seções apuradas. */
  psa: string;
  /** Seções não apuradas. */
  sna: string;
  /** Porcentagem de seções não apuradas. */
  psna: string;
  /** Total do eleitorado. */
  e: string;
  /** Eleitorado apurado. */
  ea: string;
  /** Porcentagem de eleitorado apurado. */
  pea: string;
  /** Eleitorado não apurado. */
  ena: string;
  /** Porcentagem de eleitorado não apurado. */
  pena: string;
  esi: string;
  pesi: string;
  esni: string;
  pesni: string;
  /** Comparecimento. */
  c: string;
  /** Porcentagem de comparecimento. */
  pc: string;
  /** Abstenção. */
  a: string;
  /** Porcentagem de abstenção. */
  pa: string;
  vscv: string;
  /** Votos nominais. */
  vnom: string;
  /** Porcentagem de votos nominais. */
  pvnom: string;
  /** Votos a candidatos concorrentes. */
  vvc: string;
  /** Porcentagem de votos a candidatos concorrentes. */
  pvvc: string;
  /** Votos em branco. */
  vb: string;
  /** Porcentagem de votos em branco. */
  pvb: string;
  /** Votos nulos totais. */
  tvn: string;
  /** Porcentagem de votos nulos totais. */
  ptvn: string;
  /** Votos nulos. */
  vn: string;
  /** Porcentagem de votos nulos. */
  pvn: string;
  /** Votos nulos técnicos. */
  vnt: string;
  /** Porcentagem de votos nulos técnicos. */
  pvnt: string;
  /** Votos anulados e apurados em separado. */
  vp: string;
  /** Porcentagem de votos anulados e apurados em separado. */
  pvp: string;
  /** Votos válidos. */
  vv: string;
  /** Porcentagem de votos válidos. */
  pvv: string;
  /** Votos anulados. */
  van: string;
  /** Porcentagem de votos anulados. */
  pvan: string;
  /** Votos anulados sob judice. */
  vansj: string;
  /** Porcentagem de votos anulados sob judice. */
  pvansj: string;
  /** Total de votos. */
  tv: string;
  /** Candidatos. */
  cand: AggregationRawCandidate[];
}

export interface AggregationRawCandidate {
  /** Sequencial. */
  seq: string;
  /** ID. */
  sqcand: string;
  /** Número. */
  n: string;
  /** Nome. */
  nm: string;
  /** Partido/coligação. */
  cc: string;
  /** Nome do vice. */
  nv: string;
  /** Eleito. */
  e: "s" | "n";
  /** Situação. */
  st: string;
  /** Destinação do voto. */
  dvt: string;
  /** Votos apurados. */
  vap: string;
  /** Porcentagem de votos apurados. */
  pvap: string;
}

export class Aggregation {
  constructor(
    public raw: AggregationRaw,
    private readonly minutesWaitingStableNumbers = 10
  ) {}

  public isSomeoneElected() {
    return this.raw.cand.some((candidate) => candidate.e === "s");
  }

  public isCalculationFinalized() {
    return this.raw.psa === "100,00";
  }

  public parseLastAggregationDate(): number {
    const date = this.raw.dt === "" ? this.raw.dg : this.raw.dt;
    const time = this.raw.ht === "" ? this.raw.hg : this.raw.ht;

    const [day = "30", month = "10", year = "2022"] = date.split("/");
    const [hour = "17", minutes = "00", seconds = "00"] = time.split(":");

    return Date.UTC(+year, +month - 1, +day, +hour + 3, +minutes, +seconds);
  }

  public expectedTotalValidVotes() {
    const totalElectorate = parseInt(this.raw.e);

    let percentageValidVotes = parseFloat(this.raw.pvv.replace(",", "."));
    let totalAbstentions = parseInt(this.raw.a);

    const now = new Date();
    now.setMinutes(now.getMinutes() + this.minutesWaitingStableNumbers);

    const endVotingPlus10 = new Date(END_POLLING);
    endVotingPlus10.setMinutes(
      now.getMinutes() + this.minutesWaitingStableNumbers
    );

    // Nos primeiros 10 minutos ou quando não houver dados, utilizar os dados do primeiro turno.
    if (now <= endVotingPlus10 || !percentageValidVotes) {
      percentageValidVotes = FIRST_ROUND_PERCENTAGE_VALID_VOTES;
      totalAbstentions = FIRST_ROUND_TOTAL_ABSTENTIONS;
    }

    const attendedElectorate = totalElectorate - totalAbstentions;

    return Math.ceil(attendedElectorate * (percentageValidVotes / 100));
  }

  public expectedVotesRemainingToBeElected(sqcand: string) {
    const candidate = this.raw.cand.find(
      (candidate) => candidate.sqcand === sqcand
    );

    if (!candidate) {
      throw new Error("candidate not found");
    }

    const candidateTotalVotesCounted = parseInt(candidate.vap);

    const expectedVotes =
      Math.ceil(this.expectedTotalValidVotes() / 2) -
      candidateTotalVotesCounted +
      1;

    return expectedVotes >= 0 ? expectedVotes : 0;
  }
}

// se possuem 850 votos para serem apurados de um eleitorado de 1000, se candidato A possuir 100 e candidato B possuir 50
// candidato A precisa de x votos para obter a maioria absoluta, enquanto candidato B precisa de y
//
// votos apurados = 150
// eleitorado = 1000
// votos a serem apurados = 850
//
// candidato A = 100
// candidato B = 50
//
// quem tiver mais que a metade do eleitorado, ganha
// metade do eleitorado = 500
//
// x = 500 - 100 + 1 = 401
// y = 500 - 50 + 1 = 451
