import { Message } from "./message.ts";

export interface MessageTouch {
  x: number;
  y: number;
}

export class MessageTouch extends Message {
  constructor(public x: number, public y: number) {
    super("touch");
  }
}
