import { MongoClient, Db } from 'mongodb';

const connectionString = process.env.ATLAS_URI || '';
const dbName = process.env.DB_NAME || '';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectToDatabase(): Promise<Db> {
  if (db) return db;

  if (!connectionString) {
    throw new Error('ATLAS_URI environment variable not set');
  }

  client = new MongoClient(connectionString);
  const conn = await client.connect();
  db = conn.db(dbName);
  return db;
}
