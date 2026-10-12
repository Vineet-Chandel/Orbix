import { AuthLayout } from "../AuthLayout";
import SignupForm from "./Form";

export default function SignUpPage() {
    return (
        <AuthLayout
            title="Create an account"
            subtitle="Simplify your workflow and boost your productivity with Orbix. Get started for free."
            trigger={false}
            switchText="Already a member?"
            switchLinkText="Log in"
            switchLinkHref="/auth/signin"
        >
            <SignupForm />
        </AuthLayout>
    );
}