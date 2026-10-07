
import 'dotenv/config';
import express, { type Express, type Request, type Response } from 'express';
import authRouter from './Routes/auth/auth.js';
import { testDatabaseConnection } from './database/client.js';
const app: Express = express();

app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

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