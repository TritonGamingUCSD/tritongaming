import dotenv from "dotenv";
dotenv.config(); // Load environment variables from .env file

import Server from "./server";

const server = new Server();
server.listen();
