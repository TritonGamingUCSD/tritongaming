import { Request, Response } from "express";
import EventsRepository from "../repositories/events.repository";

class EventsController {
    public async getEvents(req: Request<{}, {}, {}, any>, res: Response): Promise<void> {
        try {
            const events = await EventsRepository.findAll(req.query);
            res.status(200).json({ status: 200, message: "Success", events });
        } catch (error) {
            console.error("Failed to fetch events:", error);
            res.status(500).json({ status: 500, message: "Internal server error" });
        }
    }

    public async getEvent(req: Request<{ id: string }>, res: Response): Promise<void> {
        try {
            const event = await EventsRepository.findById(req.params.id);

            if (!event) {
                res.status(404).json({ status: 404, message: "Event not found" });
                return;
            }

            res.status(200).json({ status: 200, message: "Success", event });
        } catch (error) {
            console.error("Failed to fetch event:", error);
            res.status(500).json({ status: 500, message: "Internal server error" });
        }
    }

    public async getPreviousEvents(req: Request, res: Response): Promise<void> {
        try {
            const events = await EventsRepository.findPrevious();
            res.status(200).json({ status: 200, message: "Success", events });
        } catch (error) {
            console.error("Failed to fetch previous events:", error);
            res.status(500).json({ status: 500, message: "Internal server error" });
        }
    }

    public async getUpcomingEvents(req: Request, res: Response): Promise<void> {
        try {
            const events = await EventsRepository.findUpcoming();
            res.status(200).json({ status: 200, message: "Success", events });
        } catch (error) {
            console.error("Failed to fetch upcoming events:", error);
            res.status(500).json({ status: 500, message: "Internal server error" });
        }
    }
}

export default new EventsController();
