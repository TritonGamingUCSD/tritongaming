import express from "express";
import cors from "cors";
import path from "path";
import eventRoutes from "./routes/events.router";

class Server {
    private app = express();
    private port = process.env.PORT || 80;

    constructor() {
        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, "../app/dist")));
    }

    private setupRoutes() {
        this.app.use("/api/events", eventRoutes);

        // Serve React index.html for all other routes
        this.app.get("", (_req, res) => {
            res.sendFile(path.join(__dirname, "../app/dist/index.html"));
        });
    }

    public listen() {
        this.app.listen(this.port, () => {
            console.log(`Server running on port ${this.port}`);
        });
    }
}

export default Server;
