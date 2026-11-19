// Backend/src/Routes/events/eventEngagementRoutes.ts
import express from "express";
import { authenticate, optionalAuthenticate } from "../../middlewares/auth.middleware.js";
import {
    getEventEngagementHandler,
    getBatchEventEngagementHandler,
    likeEventHandler,
    unlikeEventHandler,
    toggleEventLikeHandler,
    recordEventShareHandler,
} from "../../controllers/events/eventEngagementController.js";

const eventEngagementRouter = express.Router();

// Batch engagement (placed before parameterized :eventId routes)
eventEngagementRouter.post("/events/engagement/batch", optionalAuthenticate, getBatchEventEngagementHandler);
eventEngagementRouter.post("/club/events/engagement/batch", optionalAuthenticate, getBatchEventEngagementHandler);

// Single event engagement
eventEngagementRouter.get("/events/:eventId/engagement", optionalAuthenticate, getEventEngagementHandler);
eventEngagementRouter.get("/club/events/:eventId/engagement", optionalAuthenticate, getEventEngagementHandler);

// Explicit Like (POST) and Unlike (DELETE)
eventEngagementRouter.post("/events/:eventId/likes", authenticate, likeEventHandler);
eventEngagementRouter.post("/club/events/:eventId/likes", authenticate, likeEventHandler);
eventEngagementRouter.delete("/events/:eventId/likes", authenticate, unlikeEventHandler);
eventEngagementRouter.delete("/club/events/:eventId/likes", authenticate, unlikeEventHandler);

// Toggle Like (Legacy compatibility)
eventEngagementRouter.post("/events/:eventId/like", authenticate, toggleEventLikeHandler);
eventEngagementRouter.post("/club/events/:eventId/like", authenticate, toggleEventLikeHandler);

// Share Tracking (both /shares and /share)
eventEngagementRouter.post("/events/:eventId/shares", optionalAuthenticate, recordEventShareHandler);
eventEngagementRouter.post("/club/events/:eventId/shares", optionalAuthenticate, recordEventShareHandler);
eventEngagementRouter.post("/events/:eventId/share", optionalAuthenticate, recordEventShareHandler);
eventEngagementRouter.post("/club/events/:eventId/share", optionalAuthenticate, recordEventShareHandler);

export default eventEngagementRouter;
