import { Request, Response } from "express";
import connectToDatabase from "../db/conn";
import { Db, Timestamp } from "mongodb";
import { Event } from "../models/Event";

export const getEvents = async (req: Request, res: Response): Promise<void> => {
    const db: Db = await connectToDatabase();
    const collection = db.collection("events");

    let rawResults = await collection.find({})
        .limit(50)
        .toArray();

    const results: Event[] = rawResults.map((doc: any) => ({
        _id: doc._id?.toString() ?? "",
        full_name: doc.full_name ?? "",
        name: doc.name ?? "",
        start_time: doc.start_time
            ? new Date(doc.start_time.getHighBits() * 1000).toISOString()
            : "",
        end_time: doc.end_time
            ? new Date(doc.end_time.getHighBits() * 1000).toISOString()
            : "",
        flyer_url: doc.flyer_url ?? "",
        location: doc.location ?? "",
        content: doc.content ?? "",
    }));

    res.status(200).send({
        status: 200,
        message: "Success",
        events: results
    });
}   
