import { Client, type ClientChannel } from 'ssh2';
import { config } from '../config.js';

interface PooledConnection {
  client: Client;
  busy: boolean;
  lastUsed: number;
}

class SshService {
  private pool: PooledConnection[] = [];
  private healthy = false;

  async getConnection(): Promise<Client> {
    // Reuse idle connection
    const idle = this.pool.find((c) => !c.busy);
    if (idle) {
      idle.busy = true;
      idle.lastUsed = Date.now();
      return idle.client;
    }

    // Create new if under limit
    if (this.pool.length < config.maxSshConnections) {
      const client = await this.connect();
      const entry: PooledConnection = { client, busy: true, lastUsed: Date.now() };
      this.pool.push(entry);
      return client;
    }

    // Wait for one to free up
    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        const freed = this.pool.find((c) => !c.busy);
        if (freed) {
          clearInterval(interval);
          freed.busy = true;
          freed.lastUsed = Date.now();
          resolve(freed.client);
        }
      }, 100);
      setTimeout(() => {
        clearInterval(interval);
        reject(new Error('SSH connection pool exhausted'));
      }, 10000);
    });
  }

  release(client: Client): void {
    const entry = this.pool.find((c) => c.client === client);
    if (entry) entry.busy = false;
  }

  private connect(): Promise<Client> {
    return new Promise((resolve, reject) => {
      const client = new Client();
      client
        .on('ready', () => {
          this.healthy = true;
          resolve(client);
        })
        .on('error', (err) => {
          this.removeFromPool(client);
          reject(err);
        })
        .on('close', () => {
          this.removeFromPool(client);
        })
        .connect({
          host: config.sshHost,
          port: config.sshPort,
          username: config.sshUser,
          privateKey: config.sshKey,
          keepaliveInterval: 15000,
          keepaliveCountMax: 3,
        });
    });
  }

  private removeFromPool(client: Client): void {
    const idx = this.pool.findIndex((c) => c.client === client);
    if (idx !== -1) {
      this.pool.splice(idx, 1);
    }
    if (this.pool.length === 0) this.healthy = false;
  }

  async exec(command: string): Promise<string> {
    const client = await this.getConnection();
    try {
      return await new Promise<string>((resolve, reject) => {
        client.exec(command, (err, stream) => {
          if (err) {
            reject(err);
            return;
          }
          let stdout = '';
          let stderr = '';
          stream
            .on('data', (data: Buffer) => {
              stdout += data.toString();
            })
            .stderr.on('data', (data: Buffer) => {
              stderr += data.toString();
            });
          stream.on('close', (code: number) => {
            if (code !== 0) {
              reject(new Error(`Command failed (${code}): ${stderr || stdout}`));
            } else {
              resolve(stdout);
            }
          });
        });
      });
    } finally {
      this.release(client);
    }
  }

  async execStream(
    command: string,
    callbacks: {
      onData: (data: string) => void;
      onError: (err: Error) => void;
      onClose: (code: number) => void;
    },
  ): Promise<ClientChannel> {
    const client = await this.getConnection();
    return new Promise((resolve, reject) => {
      client.exec(command, (err, stream) => {
        if (err) {
          this.release(client);
          reject(err);
          return;
        }
        stream
          .on('data', (data: Buffer) => {
            callbacks.onData(data.toString());
          })
          .stderr.on('data', (data: Buffer) => {
            callbacks.onData(data.toString());
          });
        stream.on('close', (code: number) => {
          this.release(client);
          callbacks.onClose(code ?? 0);
        });
        stream.on('error', (streamErr: Error) => {
          this.release(client);
          callbacks.onError(streamErr);
        });
        resolve(stream);
      });
    });
  }

  isHealthy(): boolean {
    return this.healthy;
  }

  closeAll(): void {
    for (const entry of this.pool) {
      entry.client.end();
    }
    this.pool = [];
    this.healthy = false;
  }
}

export const sshService = new SshService();
