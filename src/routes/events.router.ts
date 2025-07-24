import { Router } from "express";
import EventsController from "../controllers/events.controller";

class EventsRouter {
    public router: Router;

    constructor() {
        this.router = Router();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.get("/", EventsController.getEvents);
        this.router.get("/upcoming", EventsController.getUpcomingEvents);
        this.router.get("/previous", EventsController.getPreviousEvents);
        this.router.get("/id/:id", EventsController.getEvent);
    }
}

export default new EventsRouter().router;
