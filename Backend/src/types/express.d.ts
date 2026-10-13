export interface AuthUser {
    id: string;
    firstName: string;
    middleName?: string | undefined;
    lastName: string;
    gmail: string;
    username: string;
    termsAccepted: boolean | string;
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}
