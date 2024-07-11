import express, { urlencoded } from "express";
import { S_LIMIT } from "./constants";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

//------ MIDDLEWARES -------

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
}));

app.use(express.json({
    limit: S_LIMIT
}));

app.use(urlencoded({
    extended: true, limit: S_LIMIT
}));

app.use(express.static("public"));
app.use(cookieParser());



export { app };