import type { RequestHandler, ErrorRequestHandler } from 'express';

// Defense in depth for legacy controllers which serialize caught provider/SQL errors.
export const responsePrivacy: RequestHandler = (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    const json = res.json.bind(res);
    res.json = (body: any) => {
        if (res.statusCode >= 500) {
            body = { success: false, message: 'Something went wrong. Please try again.' };
        } else if (res.statusCode >= 400 && body && typeof body === 'object' && !Array.isArray(body)) {
            const { error, stack, trace, details, debug, ...safe } = body;
            // Some legacy routes classify caught database/provider failures as 400.
            const message = typeof safe.message === 'string' ? safe.message : '';
            const internal = /(?:ECONNREFUSED|ENOTFOUND|ETIMEDOUT|SQLSTATE|SQL syntax|relation .+ does not exist|column .+ does not exist|duplicate key value|violates .+ constraint|SELECT .+ FROM|INSERT INTO|UPDATE .+ SET|postgres(?:ql)?:\/\/|Bearer [\w.-]+|(?:ghp_|sk_live_|re_)[A-Za-z0-9]{20,}|\bat .+\.(?:ts|js):\d+)/i;
            body = internal.test(message)
                ? { success: false, message: 'We could not process this request. Please try again.' }
                : safe;
        }
        // Responses vary by session and current privacy settings. Redis handles safe caching.
        res.setHeader('Cache-Control', 'private, no-store');
        return json(body);
    };
    next();
};

export const safeUnhandledError: ErrorRequestHandler = (_err, _req, res, next) => {
    if (res.headersSent) return next(_err);
    res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
};
