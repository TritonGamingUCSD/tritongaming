import connectToDatabase from "../db/conn";
import { Db, ObjectId, SortDirection } from "mongodb";
import { Event } from "../models/Event";

type GetEventsQuery = {
    limit?: string;
    sort?: string;
    sortDir?: "asc" | "desc";
};

class EventsRepository {
    private DEF_QUERY_LIMIT: number = 50;
    private DEF_SORT_FIELD: string = "start_date";
    private DEF_SORT_DIR: SortDirection = "desc";

    private async getCollection() {
        const db: Db = await connectToDatabase();
        return db.collection("events");
    }

    public async findAll(query: GetEventsQuery): Promise<Event[]> {
        const collection = await this.getCollection();

        const limit = query.limit ? parseInt(query.limit, 10) : this.DEF_QUERY_LIMIT;
        const sortField = query.sort ?? this.DEF_SORT_FIELD;
        const sortDir: SortDirection = query.sortDir ?? this.DEF_SORT_DIR;

        const rawResults = await collection
            .find({})
            .sort({ [sortField]: sortDir })
            .limit(limit)
            .toArray();

        return rawResults.map(this.mapEvent);
    }

    public async findById(id: string): Promise<Event | null> {
        const collection = await this.getCollection();

        if (!ObjectId.isValid(id)) return null;

        const doc = await collection.findOne({ _id: new ObjectId(id) });

        return doc ? this.mapEvent(doc) : null;
    }

    public async findPrevious(limit = this.DEF_QUERY_LIMIT): Promise<Event[]> {
        const collection = await this.getCollection();
        const nowUTC = new Date(new Date().toISOString()); // Ensures UTC-safe object

        const rawResults = await collection
            .find({ start_date: { $lt: nowUTC } })
            .sort({ start_date: -1 })
            .limit(limit)
            .toArray();

        return rawResults.map(this.mapEvent);
    }

    public async findUpcoming(limit = this.DEF_QUERY_LIMIT): Promise<Event[]> {
        const collection = await this.getCollection();
        const nowUTC = new Date(new Date().toISOString());

        const rawResults = await collection
            .find({ start_date: { $gte: nowUTC } })
            .sort({ start_date: 1 })
            .limit(limit)
            .toArray();

        return rawResults.map(this.mapEvent);
    }

    private mapEvent(doc: any): Event {
        return {
            _id: doc._id?.toString() ?? "",
            full_name: doc.full_name ?? "",
            name: doc.name ?? "",
            start_date: new Date(doc.start_date),
            end_date: new Date(doc.end_date),
            flyer_url: doc.flyer_url ?? "",
            location: doc.location ?? "",
            content: doc.content ?? "",
            url: doc.url ?? ""
        };
    }
}

export default new EventsRepository();
