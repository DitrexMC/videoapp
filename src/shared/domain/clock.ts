export interface Clock {
  now(): Date;
  nowIsoString(): string;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  nowIsoString(): string {
    return this.now().toISOString();
  }
}