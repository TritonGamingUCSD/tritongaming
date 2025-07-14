import express, { Application, Request, Response } from "express";
import cors from "cors";
import path from "path";
import event from "./routes/event";

interface Paths {
    event: string;
}

class Server {
    private app: Application;
    private port: string | number;
    private paths: Paths;

    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.paths = {
            event: "/api/event",
        };

        this.middlewares();
        this.routes();
    }

    private middlewares(): void {
        this.app.use(cors());
        this.app.use(express.json());

        // Serve static files from the frontend
        this.app.use(express.static(path.join(__dirname, "../app/dist")));
    }

    private routes(): void {
        this.app.use(this.paths.event, event);

        // Catch-all handler to serve React's index.html
        this.app.get("", (_req: Request, res: Response) => {
            res.sendFile(
                path.join(__dirname, "../app/dist/index.html")
            );
        });
    }

    public listen(): void {
        this.app.listen(this.port, () => {
            console.log("Server running on port:", this.port);
        });
    }
}

export default Server;
