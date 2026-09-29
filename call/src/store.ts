import { MongoClient, type Collection } from 'mongodb';

export type RoomDoc = {
  consultId: string;
  roomName: string;
  status: 'open' | 'closed';
  createdAt: Date;
  closedAt?: Date;
};

export class RoomStore {
  private memory = new Map<string, RoomDoc>();
  private collection: Collection<RoomDoc> | null = null;

  async init() {
    const uri = process.env.CALL_MONGODB_URI?.trim();
    if (!uri) return;
    const client = new MongoClient(uri);
    await client.connect();
    this.collection = client.db('aronno-call').collection<RoomDoc>('rooms');
    await this.collection.createIndex({ consultId: 1 }, { unique: true });
  }

  async upsertOpen(consultId: string, roomName: string) {
    const doc: RoomDoc = {
      consultId,
      roomName,
      status: 'open',
      createdAt: new Date(),
    };
    if (!this.collection) {
      this.memory.set(consultId, doc);
      return doc;
    }
    await this.collection.updateOne(
      { consultId },
      { $set: { roomName, status: 'open', createdAt: doc.createdAt }, $unset: { closedAt: '' } },
      { upsert: true },
    );
    return doc;
  }

  async get(consultId: string) {
    if (!this.collection) return this.memory.get(consultId) ?? null;
    return this.collection.findOne({ consultId });
  }

  async close(consultId: string) {
    const closedAt = new Date();
    if (!this.collection) {
      const current = this.memory.get(consultId);
      if (current) this.memory.set(consultId, { ...current, status: 'closed', closedAt });
      return;
    }
    await this.collection.updateOne(
      { consultId },
      { $set: { status: 'closed', closedAt } },
    );
  }
}
