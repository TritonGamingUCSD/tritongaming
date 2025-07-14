import { Request, Response } from "express";
import connectToDatabase from "../db/conn";
import { Db, ObjectId, SortDirection } from "mongodb";
import { Event } from "../models/Event";

type GetEventsQuery = {
    limit?: string;
    sort?: string;
    sortDir?: "asc" | "desc";
};

// GET /events
export const getEvents = async (
    req: Request<{}, {}, {}, GetEventsQuery>,
    res: Response
): Promise<void> => {
    try {
        const db: Db = await connectToDatabase();
        const collection = db.collection("events");

        const limit = parseInt(req.query.limit ?? "50", 10);
        const sortField = req.query.sort ?? "start_date";
        const sortDir: SortDirection = req.query.sortDir === "asc" ? 1 : -1;

        const rawResults = await collection
            .find({})
            .sort({ [sortField]: sortDir })
            .limit(limit)
            .toArray();

        const results: Event[] = rawResults.map((doc: any) => ({
            _id: doc._id?.toString() ?? "",
            full_name: doc.full_name ?? "",
            name: doc.name ?? "",
            start_date: doc.start_date ?? new Date(),
            end_date: doc.end_date ?? new Date(),
            flyer_url: doc.flyer_url ?? "",
            location: doc.location ?? "",
            content: doc.content ?? "",
        }));

        res.status(200).json({
            status: 200,
            message: "Success",
            events: results,
        });
    } catch (error) {
        console.error("Failed to fetch events:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// GET /events/:id
export const getEvent = async (
    req: Request<{ id: string }>,
    res: Response
): Promise<void> => {
    try {
        const db: Db = await connectToDatabase();
        const collection = db.collection("events");

        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
            res.status(400).json({ message: "Invalid event ID" });
            return;
        }

        const doc = await collection.findOne({ _id: new ObjectId(id) });

        if (!doc) {
            res.status(404).json({ message: "Event not found" });
            return;
        }

        const result: Event = {
            _id: doc._id?.toString() ?? "",
            full_name: doc.full_name ?? "",
            name: doc.name ?? "",
            start_date: doc.start_date ?? new Date(),
            end_date: doc.end_date ?? new Date(),
            flyer_url: doc.flyer_url ?? "",
            location: doc.location ?? "",
            content: doc.content ?? "",
        };

        res.status(200).json({
            status: 200,
            message: "Success",
            event: result,
        });
    } catch (error) {
        console.error("Failed to fetch event:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
