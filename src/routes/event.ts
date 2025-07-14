import { Router } from "express";
import { getEvent, getEvents } from "../controllers/event";

const router = Router();

router.get("/", getEvents);
router.get("/:id", getEvent);

export default router;
