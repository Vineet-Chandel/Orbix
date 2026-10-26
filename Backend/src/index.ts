
import 'dotenv/config';
import express, { type Express, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import authRouter from './Routes/auth/auth.js';
import portalsRouter from './Routes/portals/portals.js';
import profileRouter from './Routes/profile/profile.js';
import leaderboardRouter from './Routes/leaderboard/leaderboard.js';
import eventsRouter from './Routes/events/events.js';
import notificationsRouter from './Routes/notifications/notifications.js';
import institutionsRouter from './Routes/institutions/institutions.js';
import clubRouter from './Routes/club/club.js';
import {
    relationshipRouter,
    blockRouter,
    settingsRelationshipRouter,
} from './Routes/relationships/relationshipRoutes.js';
import { testDatabaseConnection } from './database/client.js';
import redis from './redis/client.js';

const app: Express = express();

app.use((req: Request, res: Response, next: express.NextFunction) => {
    const origin = req.headers.origin;
    if (origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    } else {
        res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
        res.sendStatus(200);
        return;
    }
    next();
});

app.use(cookieParser());
app.use(express.json());
app.use((err: any, req: Request, res: Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json({ error: "Invalid JSON payload" });
        return;
    }
    next();
});

app.use('/api', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/portals', portalsRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/events', eventsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/institutions', institutionsRouter);
app.use('/api/club', clubRouter);
app.use('/api/relationships', relationshipRouter);
app.use('/api/blocks', blockRouter);
app.use('/api/settings', settingsRelationshipRouter);
app.use('/relationships', relationshipRouter);
app.use('/blocks', blockRouter);
app.use('/profile', profileRouter);
app.get('/', (req: Request, res: Response) => {
    res.send('Hello World!');
});



const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

        testDatabaseConnection().catch((error) => {
            console.warn("⚠️ Database connection check warning:", error.message || error);
        });
    } catch (error) {
        console.error("Server startup failed:", error);
    }
};

startServer();