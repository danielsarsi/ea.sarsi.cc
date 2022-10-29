export class ClientBox {
  private clients = new Map<string, WebSocket>();

  public add(ws: WebSocket): string {
    const uuid = this.generateIdentifier();
    this.clients.set(uuid, ws);
    return uuid;
  }

  public remove(uuid: string): string | undefined {
    if (this.clients.has(uuid)) {
      this.clients.delete(uuid);
      return uuid;
    }

    return undefined;
  }

  public get(uuid: string): WebSocket | undefined {
    return this.clients.get(uuid);
  }

  public send(uuid: string, message: string): boolean {
    const socket = this.clients.get(uuid);

    if (!socket) {
      return false;
    }

    socket.send(message);
    return true;
  }

  public broadcast(message: string, exceptions?: string[]): void {
    console.debug(`broadcasting to ${this.clients.size} client(s)`);

    for (const [uuid, socket] of this.clients.entries()) {
      if (!exceptions?.includes(uuid)) {
        socket.send(message);
      }
    }
  }

  private generateIdentifier(): string {
    return crypto.randomUUID();
  }
}
