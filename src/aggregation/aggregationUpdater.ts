import { Aggregation, AggregationRaw } from "./aggregation.ts";
import { AGGREGATION_URL, END_POLLING } from "../constants.ts";
import { diff } from "../deps.ts";

export class AggregationUpdater extends EventTarget {
  private intervalToUpdateInSeconds = 1;

  private lastAggregation?: Aggregation;

  private isUpdating = false;
  private updateIntervalTimer?: number;

  private calculateIntervalToUpdate() {
    // Padrão = 300s
    // Se for 1 hora antes do fim da votação, atualizar a cada 60 segundos.
    // Se for 30 minutos antes do fim da votação, atualizar a cada 30 segundos.
    // Se for 5 minutos antes do fim da votação, atualizar a cada 1 segundo.

    const now = new Date();

    const timeRemaining = END_POLLING.getTime() - now.getTime();
    const minutesRemaining = Math.floor(timeRemaining / 1000 / 60);

    if (minutesRemaining <= 5) {
      return 1;
    }

    if (minutesRemaining > 5 && minutesRemaining <= 30) {
      return 30;
    }

    if (minutesRemaining > 30 && minutesRemaining <= 60) {
      return 60;
    }

    return 300;
  }

  public async start() {
    const intervalToUpdateInSeconds = this.calculateIntervalToUpdate();
    this.intervalToUpdateInSeconds = intervalToUpdateInSeconds;

    console.info(
      `starting poll aggregation updates (every ${this.intervalToUpdateInSeconds}s)`
    );

    if (!this.lastAggregation) {
      await this.update();
    }

    this.updateIntervalTimer = setInterval(() => {
      if (this.isUpdating) {
        console.warn("already updating");
        return;
      }

      this.update();
    }, this.intervalToUpdateInSeconds * 1000);
  }

  public stop() {
    console.info("stopping poll aggregation updates");
    clearInterval(this.updateIntervalTimer);
  }

  private async update() {
    console.debug("updating poll aggregation");

    this.isUpdating = true;

    try {
      const aggregationRaw = await this.getFromSource();

      if (!this.lastAggregation) {
        this.lastAggregation = new Aggregation(aggregationRaw);
      }

      const lastAggregationRaw = this.lastAggregation.raw;

      if (diff(aggregationRaw, lastAggregationRaw).length > 0) {
        this.lastAggregation = new Aggregation(aggregationRaw);
        this.dispatchEvent(new Event("update"));
      }
    } catch (error) {
      console.error(error, "error updating poll aggregation");
    }

    const intervalToUpdateInSeconds = this.calculateIntervalToUpdate();

    if (intervalToUpdateInSeconds !== this.intervalToUpdateInSeconds) {
      console.info(
        `should change interval to update (${this.intervalToUpdateInSeconds} to ${intervalToUpdateInSeconds})`
      );

      this.stop();
      await this.start();
    }

    this.isUpdating = false;
  }

  private async getFromSource(): Promise<AggregationRaw> {
    const timeStart = performance.now();
    const response = await fetch(AGGREGATION_URL);
    const timeEnd = performance.now();

    console.debug({ ms: timeEnd - timeStart }, "got from source");

    return response.json();
  }

  public getLastAggregation() {
    return this.lastAggregation;
  }
}
