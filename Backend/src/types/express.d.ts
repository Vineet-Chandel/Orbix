export interface AuthUser {
    id: string;
    firstName: string;
    middleName?: string | undefined;
    lastName: string;
    gmail: string;
    email?: string;
    username: string;
    phone?: string;
    termsAccepted: boolean | string;
    accountType?: string;
    account_type?: string;
    isEmailVerified?: boolean;
    isPhoneVerified?: boolean;
    isSuperAdmin?: boolean;
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}
