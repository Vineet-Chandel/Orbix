export interface AuthUser {
    id: string;
    firstName: string;
    middleName?: string | undefined;
    lastName: string;
    gmail: string;
    email?: string;
    username: string;
    termsAccepted: boolean | string;
    accountType?: string;
    account_type?: string;
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}
