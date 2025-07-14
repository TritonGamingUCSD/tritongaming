import { MongoClient, Db } from "mongodb";

const connectionString = process.env.ATLAS_URI || "";
const dbName = process.env.DB_NAME || "";

const client = new MongoClient(connectionString);

let db: Db;

async function connectToDatabase(): Promise<Db> {
    if (!db) {
        try {
            const conn = await client.connect();
            db = conn.db(dbName);
            console.log("✅ Connected to MongoDB");
        } catch (e) {
            console.error("❌ MongoDB connection failed:", e);
            throw e;
        }
    }
    return db;
}

export default connectToDatabase;
