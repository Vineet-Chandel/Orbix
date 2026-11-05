
import 'dotenv/config';
import express, { type Express, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import authRouter from './Routes/auth/auth.js';
import { oauthRouter } from './Routes/auth/oauthRoutes.js';
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
import { helpRouter } from './Routes/help/helpRoutes.js';
import verificationRouter from './Routes/verification/verificationRoutes.js';
import manageAccountsRouter from './Routes/account/manageAccountsRoutes.js';
import blogRouter from './Routes/blog/blogRoutes.js';
import { accountGovernanceRouter } from './Routes/account/accountGovernanceRoutes.js';
import { privacyRouter } from './Routes/account/privacyRoutes.js';
import { platformRouter } from './Routes/platform/platformRoutes.js';
import { sessionRouter } from './Routes/session/sessionRoutes.js';
import { testDatabaseConnection } from './database/client.js';
import { startAccountPurgeWorker } from './services/account/accountPurgeService.js';
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
    
    const requestedHeaders = req.headers["access-control-request-headers"];
    if (requestedHeaders) {
        res.setHeader("Access-Control-Allow-Headers", requestedHeaders);
    } else {
        res.setHeader(
            "Access-Control-Allow-Headers",
            "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-orbix-device-id, X-Orbix-Device-Id, *"
        );
    }
    res.setHeader("Access-Control-Expose-Headers", "Authorization, Set-Cookie");

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
app.use('/api/auth', oauthRouter);
app.use('/auth', oauthRouter);
app.use('/api/profile', profileRouter);
app.use('/api/portals', portalsRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/events', eventsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/institutions', institutionsRouter);
app.use('/api/club', clubRouter);
app.use('/api/clubs', clubRouter);
app.use('/clubs', clubRouter);
app.use('/api/relationships', relationshipRouter);
app.use('/api/blocks', blockRouter);
app.use('/api/settings', settingsRelationshipRouter);
app.use('/api/help', helpRouter);
app.use('/help', helpRouter);
app.use('/api/verification', verificationRouter);
app.use('/api/settings/verification', verificationRouter);
app.use('/api/settings/manage-account', manageAccountsRouter);
app.use('/api/manage-account', manageAccountsRouter);
app.use('/api/account/governance', accountGovernanceRouter);
app.use('/api/account/privacy', privacyRouter);
app.use('/api/privacy', privacyRouter);
app.use('/api/account/sessions', sessionRouter);
app.use('/api/account', sessionRouter);
app.use('/api', sessionRouter);
app.use('/api/account', manageAccountsRouter);
app.use('/api/platform', platformRouter);
app.use('/api/about', platformRouter);
app.use('/relationships', relationshipRouter);
app.use('/blocks', blockRouter);
app.use('/profile', profileRouter);
app.use('/api/blogs', blogRouter);
app.use('/api/blog', blogRouter);
app.get('/', (req: Request, res: Response) => {
    res.send('Hello World!');
});



const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        app.listen(Number(PORT), '0.0.0.0', () => {
            console.log(`Server running on port ${PORT}`);
        });

        testDatabaseConnection().catch((error) => {
            console.warn("⚠️ Database connection check warning:", error.message || error);
        });

        // Start automated 7-day account deletion purge worker
        try {
            startAccountPurgeWorker();
        } catch (workerErr) {
            console.error("Failed to initialize account purge worker:", workerErr);
        }
    } catch (error) {
        console.error("Server startup failed:", error);
    }
};

startServer();