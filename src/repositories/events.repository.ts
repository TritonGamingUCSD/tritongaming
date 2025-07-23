import connectToDatabase from "../db/conn";
import { Db, ObjectId, SortDirection } from "mongodb";
import { Event } from "../models/Event";

type GetEventsQuery = {
    limit?: string;
    sort?: string;
    sortDir?: "asc" | "desc";
};

class EventsRepository {

    // Default values
    private DEF_QUERY_LIMIT: number = 50;
    private DEF_SORT_FIELD: string = "start_date";
    private DEF_SORT_DIR: SortDirection = "desc";


    private async getCollection() {
        const db: Db = await connectToDatabase();
        return db.collection("events");
    }

    public async findAll(query: GetEventsQuery): Promise<Event[]> {
        const collection = await this.getCollection();

        const limit = (query.limit) ? parseInt(query.limit, 10) : this.DEF_QUERY_LIMIT = 50;
;
        const sortField = query.sort ?? this.DEF_SORT_FIELD;
        const sortDir: SortDirection = query.sortDir ?? this.DEF_SORT_DIR;

        const rawResults = await collection
            .find({})
            .sort({ [sortField]: sortDir })
            .limit(limit)
            .toArray();

        return rawResults.map((doc: any) => ({
            _id: doc._id?.toString() ?? "",
            full_name: doc.full_name ?? "",
            name: doc.name ?? "",
            start_date: doc.start_date ?? new Date(),
            end_date: doc.end_date ?? new Date(),
            flyer_url: doc.flyer_url ?? "",
            location: doc.location ?? "",
            content: doc.content ?? "",
        }));
    }

    public async findById(id: string): Promise<Event | null> {
        const collection = await this.getCollection();

        if (!ObjectId.isValid(id)) return null;

        const doc = await collection.findOne({ _id: new ObjectId(id) });

        if (!doc) return null;

        return {
            _id: doc._id?.toString() ?? "",
            full_name: doc.full_name ?? "",
            name: doc.name ?? "",
            start_date: doc.start_date ?? new Date(),
            end_date: doc.end_date ?? new Date(),
            flyer_url: doc.flyer_url ?? "",
            location: doc.location ?? "",
            content: doc.content ?? "",
        };
    }
}

export default new EventsRepository();
