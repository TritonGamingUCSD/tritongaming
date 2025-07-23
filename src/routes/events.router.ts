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
        this.router.get("/:id", EventsController.getEvent);
    }
}

export default new EventsRouter().router;
