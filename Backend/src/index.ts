
import 'dotenv/config';
import express, { type Express, type Request, type Response } from 'express';
import authRouter from './Routes/auth/auth.js';
import { testDatabaseConnection } from './database/client.js';
import redis from './redis/client.js';

const app: Express = express();

app.use(express.json());
app.use((err: any, req: Request, res: Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json({ error: "Invalid JSON payload" });
        return;
    }
    next();
});

app.use('/api', authRouter);
app.get('/', (req: Request, res: Response) => {
    res.send('Hello World!');
});



const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        await testDatabaseConnection();

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });


    } catch (error) {
        console.error("Server startup failed:", error);
        process.exit(1);
    }
};

startServer();