// Backend/src/Routes/blog/blogRoutes.ts
import express from "express";
import { authenticate, optionalAuthenticate } from "../../middlewares/auth.middleware.js";
import {
    getPublicationLikesHandler,
    getBatchPublicationLikesHandler,
    likePublicationHandler,
    unlikePublicationHandler,
} from "../../controllers/blog/blogLikeController.js";

export const blogRouter = express.Router();

// Batch endpoint registered first to prevent clash with parameterized :hoster/:blogName
blogRouter.post("/likes/batch", optionalAuthenticate, getBatchPublicationLikesHandler);

// Single publication endpoints
blogRouter.get("/:hoster/:blogName/likes", optionalAuthenticate, getPublicationLikesHandler);
blogRouter.post("/:hoster/:blogName/likes", authenticate, likePublicationHandler);
blogRouter.delete("/:hoster/:blogName/likes", authenticate, unlikePublicationHandler);

export default blogRouter;

