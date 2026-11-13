if (typeof process.loadEnvFile === 'function' && process.env.NODE_ENV !== 'test') {
  try {
    process.loadEnvFile();
  } catch {}
}
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
import { studentCollegeVerificationRouter, founderCollegeVerificationRouter } from './Routes/verification/collegeVerificationRoutes.js';
import manageAccountsRouter from './Routes/account/manageAccountsRoutes.js';
import blogRouter from './Routes/blog/blogRoutes.js';
import { accountGovernanceRouter } from './Routes/account/accountGovernanceRoutes.js';
import { privacyRouter } from './Routes/account/privacyRoutes.js';
import { platformRouter } from './Routes/platform/platformRoutes.js';
import { sessionRouter } from './Routes/session/sessionRoutes.js';
import { eventFormRouter } from './Routes/events/eventFormRoutes.js';
import { eventTeamRouter } from './Routes/events/eventTeamRoutes.js';
import { clubCredibilityRouter } from './Routes/club/clubCredibilityRoutes.js';
import projectRouter from './Routes/projects/projectRoutes.js';
import { workspaceRouter } from './Routes/workspace/workspaceRoutes.js';
import { testDatabaseConnection } from './database/client.js';
import { startAccountPurgeWorker } from './services/account/accountPurgeService.js';
import redis from './redis/client.js';

const app: Express = express();

app.use((req: Request, res: Response, next: express.NextFunction) => {
    const origin = req.headers.origin;
    if (origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    
    const requestedHeaders = req.headers["access-control-request-headers"];
    if (requestedHeaders) {
        res.setHeader("Access-Control-Allow-Headers", requestedHeaders);
    } else {
        res.setHeader(
            "Access-Control-Allow-Headers",
            "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-orbix-device-id, X-Orbix-Device-Id"
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

// ============================================================================
// CENTRALIZED API ROUTE ARCHITECTURE (EVERY BACKEND ENDPOINT PREFIXED WITH /api)
// ============================================================================
const apiRouter = express.Router();

// System Health & Root Status Endpoints
apiRouter.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
        success: true,
        service: "orbix-backend",
        status: "healthy",
        timestamp: new Date().toISOString()
    });
});

apiRouter.get('/', (req: Request, res: Response) => {
    res.status(200).json({
        success: true,
        service: "orbix-backend",
        message: "Orbix API v1 operational",
        timestamp: new Date().toISOString()
    });
});

// Authentication & OAuth
apiRouter.use('/auth', authRouter);
apiRouter.use('/auth', oauthRouter);

// Profile, Users & Portals
apiRouter.use('/profile', profileRouter);
apiRouter.use('/users', profileRouter);
apiRouter.use('/portals', portalsRouter);
apiRouter.use('/projects', projectRouter);

// Leaderboard & Competitions
apiRouter.use('/leaderboard', leaderboardRouter);

// Events & Dynamic Event Forms
apiRouter.use('/events', eventsRouter);
apiRouter.use('/', eventFormRouter); // Handles /api/club/events/:id/form & /api/events/:id/form
apiRouter.use('/', eventTeamRouter); // Handles /api/events/:id/teams & /api/club/events/:id/teams

// Notifications & Institutions
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/institutions', institutionsRouter);

// Team Workspace
apiRouter.use('/club/workspace', workspaceRouter);
apiRouter.use('/workspace', workspaceRouter);
apiRouter.use('/team-workspaces', workspaceRouter);

// Clubs (both /api/club and /api/clubs)
apiRouter.use('/club', clubCredibilityRouter);
apiRouter.use('/clubs', clubCredibilityRouter);
apiRouter.use('/club', clubRouter);
apiRouter.use('/clubs', clubRouter);

// Social Relationships & Safety
apiRouter.use('/relationships', relationshipRouter);
apiRouter.use('/blocks', blockRouter);

// Settings, Governance & Account Management
apiRouter.use('/settings', settingsRelationshipRouter);
apiRouter.use('/settings/verification', verificationRouter);
apiRouter.use('/verification', verificationRouter);
apiRouter.use('/settings/manage-account', manageAccountsRouter);
apiRouter.use('/manage-account', manageAccountsRouter);
apiRouter.use('/account/governance', accountGovernanceRouter);
apiRouter.use('/account/privacy', privacyRouter);
apiRouter.use('/privacy', privacyRouter);
apiRouter.use('/account/sessions', sessionRouter);
apiRouter.use('/account', sessionRouter);
apiRouter.use('/account', manageAccountsRouter);

// College Institutional Verification (Stage 4.4 - 4.6)
apiRouter.use('/verification/college', studentCollegeVerificationRouter);
apiRouter.use('/college-verification', studentCollegeVerificationRouter);
apiRouter.use('/internal/college-verifications', founderCollegeVerificationRouter);

// Support & Help Desk
apiRouter.use('/help', helpRouter);

// Platform, About & Editorial Blogs
apiRouter.use('/platform', platformRouter);
apiRouter.use('/about', platformRouter);
apiRouter.use('/blogs', blogRouter);
apiRouter.use('/blog', blogRouter);

// Legacy fallback alias for un-nested auth endpoints under /api (e.g. /api/signin)
apiRouter.use('/', authRouter);

// Mount centralized apiRouter exclusively under /api
app.use('/api', apiRouter);

// Root health and service check (for ELB, reverse proxies & process managers)
app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
        success: true,
        service: "orbix-backend",
        status: "healthy",
        timestamp: new Date().toISOString()
    });
});

// Legacy root fallback aliases for backwards compatibility
app.use('/auth', oauthRouter);
app.use('/profile', profileRouter);
app.use('/relationships', relationshipRouter);
app.use('/blocks', blockRouter);
app.use('/help', helpRouter);
app.use('/clubs', clubRouter);

app.get('/', (req: Request, res: Response) => {
    res.status(200).json({
        success: true,
        service: "orbix-backend",
        message: "Orbix Backend Service Operational",
        api: "/api"
    });
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
