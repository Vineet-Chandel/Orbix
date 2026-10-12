import { AuthLayout } from "../AuthLayout";
import SigninForm from "./Form";

export default function SignInPage() {
    return (
        <AuthLayout
            title="Welcome back!"
            subtitle="Simplify your workflow and boost your productivity with Orbix. Get started for free."
            trigger={true}
            switchText="Not a member?"
            switchLinkText="Register now"
            switchLinkHref="/auth/signup"
        >
            <SigninForm />
        </AuthLayout>
    );
}