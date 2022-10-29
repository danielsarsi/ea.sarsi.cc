import { END_POLLING, START_POLLING } from "../constants.ts";

export type MessageType = "touch" | "polling" | "sync";
export type MessagePollingState = "before" | "polling" | "after";

export interface Message {
  readonly type: MessageType;
  readonly now: number;
  readonly pollingState: MessagePollingState;
}

export class Message {
  public readonly now = Date.now();
  public readonly state = Message.stateForNow();

  constructor(public readonly type: MessageType = "sync") {}

  public static stateForNow(
    now = Date.now(),
    startVoting = START_POLLING.getTime(),
    endVoting = END_POLLING.getTime()
  ): MessagePollingState {
    if (now >= startVoting && now <= endVoting) {
      return "polling";
    } else if (now < startVoting) {
      return "before";
    }

    return "after";
  }

  public toJSONString() {
    return JSON.stringify(this);
  }
}
