import { Timestamp } from "mongodb";

export type Event = {
    _id: string;
    full_name: string;
    name: string;
    start_time: string;
    end_time: string;
    flyer_url: string;
    location: string;
    content: string;
};