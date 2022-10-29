import { Aggregation } from "../aggregation/aggregation.ts";
import { capitalize, parsePercentage } from "../utils.ts";
import { Message } from "./message.ts";

type PercentageTotal = [percentage: number, total: number];

export interface MessagePolling {
  aggregation: MessagePollingAggregation;
}

interface MessagePollingAggregation {
  time: number;
  sectionsTotalized: PercentageTotal;
  sectionsCleared: PercentageTotal;
  votes: number;
  blankVotes: PercentageTotal;
  nullVotes: PercentageTotal;
  validVotes: PercentageTotal;
  candidates: MessagePollingAggregationCandidate[];
}

interface MessagePollingAggregationCandidate {
  id: number;
  name: string;
  elected: boolean;
  votes: PercentageTotal;
  votesToBeElected: number;
}

export class MessagePolling extends Message {
  constructor(aggregation: Aggregation) {
    super("polling");

    this.aggregation = MessagePolling.parseAggregation(aggregation);
  }

  public static parseAggregation(
    aggregation: Aggregation
  ): MessagePollingAggregation {
    const candidates =
      aggregation.raw.cand.map<MessagePollingAggregationCandidate>(
        (candidate) => ({
          id: parseInt(candidate.seq),
          elected: candidate.e === "s",
          name: capitalize(candidate.nm),
          votes: [parsePercentage(candidate.pvap), parseInt(candidate.vap)],
          votesToBeElected: aggregation.expectedVotesRemainingToBeElected(
            candidate.sqcand
          ),
        })
      );

    return {
      time: aggregation.parseLastAggregationDate(),
      sectionsTotalized: [
        parsePercentage(aggregation.raw.pst),
        parseInt(aggregation.raw.st),
      ],
      sectionsCleared: [
        parsePercentage(aggregation.raw.psa),
        parseInt(aggregation.raw.sa),
      ],
      votes: parseInt(aggregation.raw.tv),
      validVotes: [
        parsePercentage(aggregation.raw.pvv),
        parseInt(aggregation.raw.vv),
      ],
      blankVotes: [
        parsePercentage(aggregation.raw.pvb),
        parseInt(aggregation.raw.vb),
      ],
      nullVotes: [
        parsePercentage(aggregation.raw.ptvn),
        parseInt(aggregation.raw.vn),
      ],
      candidates,
    };
  }
}
