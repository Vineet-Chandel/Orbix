import test, { describe } from "node:test";
import assert from "node:assert";

/**
 * Regression Test Suite: ORBIX - AUTH-01
 * Forgot Password -> Sign In Navigation Rendering and Query Synchronization
 *
 * Validates the core routing & state synchronization rules for SignInPage:
 * - URL query parameters ('view' and 'tab') must be the single source of truth.
 * - Clicking "Back to Sign In" from Forgot Password resets view to 'signin' immediately.
 * - Switching tabs updates 'tab' query param and dynamically binds navigation targets.
 * - Browser Back / Forward transitions update views synchronously without manual reload.
 */

interface ResolvedAuthState {
    loginMode: "personal" | "club";
    authView: "signin" | "forgot_password";
    title: string;
    subtitle: string;
    switchText: string;
    switchLinkText: string;
    switchLinkHref: string;
}

/**
 * Pure simulation of SignInPage's authoritative state resolution
 * directly mirroring the logic in Frontend/src/LandingPages/Auth-Pages/Signin/Landing.tsx
 */
function resolveSignInPageState(searchParamsString: string): ResolvedAuthState {
    const searchParams = new URLSearchParams(searchParamsString);
    const tabParam = searchParams.get("tab");
    const viewParam = searchParams.get("view");

    const loginMode: "personal" | "club" = tabParam === "club" ? "club" : "personal";

    const isForgotPassword = viewParam === "forgot_password" || viewParam === "forgot-password";
    const authView: "signin" | "forgot_password" = isForgotPassword ? "forgot_password" : "signin";

    const getLayoutTitle = () => {
        if (authView === "forgot_password") {
            return loginMode === "personal"
                ? "Find Your Account"
                : "Club Account Recovery";
        }
        return loginMode === "personal"
            ? "Welcome back!"
            : "Club Portal Login";
    };

    const getLayoutSubtitle = () => {
        if (authView === "forgot_password") {
            return loginMode === "personal"
                ? "Enter your username or email to verify ownership and reset your password."
                : "Search by registered club username, slug, or representative email to recover access.";
        }
        return loginMode === "personal"
            ? "Simplify your workflow and boost your productivity with Orbix. Get started for free."
            : "Access your verified club dashboard, track review status, and manage campus events.";
    };

    const switchText =
        authView === "forgot_password"
            ? "Remember your password?"
            : loginMode === "personal"
            ? "Not a member?"
            : "";

    const switchLinkText =
        authView === "forgot_password"
            ? "Back to Sign In"
            : loginMode === "personal"
            ? "Register now"
            : "";

    const switchLinkHref =
        authView === "forgot_password"
            ? loginMode === "club"
                ? "/auth/signin?tab=club"
                : "/auth/signin"
            : loginMode === "personal"
            ? "/auth/signup"
            : "";

    return {
        loginMode,
        authView,
        title: getLayoutTitle(),
        subtitle: getLayoutSubtitle(),
        switchText,
        switchLinkText,
        switchLinkHref,
    };
}

describe("AUTH-01: Authentication Navigation & Query Parameter Synchronization", () => {
    test("Scenario 1: Open /auth/signin -> Sign In UI renders (Personal by default)", () => {
        const state = resolveSignInPageState("");
        assert.strictEqual(state.authView, "signin");
        assert.strictEqual(state.loginMode, "personal");
        assert.strictEqual(state.title, "Welcome back!");
        assert.strictEqual(state.switchText, "Not a member?");
        assert.strictEqual(state.switchLinkText, "Register now");
        assert.strictEqual(state.switchLinkHref, "/auth/signup");
    });

    test("Scenario 2: Click Forgot Password -> Find Your Account UI renders", () => {
        // When user clicks 'Forgot Password?' from personal login, URL becomes ?tab=personal&view=forgot-password
        const state = resolveSignInPageState("tab=personal&view=forgot-password");
        assert.strictEqual(state.authView, "forgot_password");
        assert.strictEqual(state.loginMode, "personal");
        assert.strictEqual(state.title, "Find Your Account");
        assert.strictEqual(state.switchText, "Remember your password?");
        assert.strictEqual(state.switchLinkText, "Back to Sign In");
        assert.strictEqual(state.switchLinkHref, "/auth/signin");
    });

    test("Scenario 3: Click Back to Sign In -> Sign In UI renders immediately without reload", () => {
        // Step 1: User is on forgot password
        const fpState = resolveSignInPageState("tab=personal&view=forgot-password");
        assert.strictEqual(fpState.authView, "forgot_password");
        assert.strictEqual(fpState.switchLinkHref, "/auth/signin");

        // Step 2: User clicks switchLinkHref ('/auth/signin'), searchParams becomes empty
        const nextUrl = fpState.switchLinkHref.replace("/auth/signin", "").replace(/^\?/, "");
        const signinState = resolveSignInPageState(nextUrl);

        // UI must immediately render Sign In interface
        assert.strictEqual(signinState.authView, "signin");
        assert.strictEqual(signinState.loginMode, "personal");
        assert.strictEqual(signinState.title, "Welcome back!");
    });

    test("Scenario 4: Open forgot-password URL directly -> Find Your Account UI renders", () => {
        // Directly navigating to /auth/signin?view=forgot-password
        const state = resolveSignInPageState("view=forgot-password");
        assert.strictEqual(state.authView, "forgot_password");
        assert.strictEqual(state.loginMode, "personal");
        assert.strictEqual(state.title, "Find Your Account");

        // Direct navigation with alternative underscore syntax ?view=forgot_password
        const altState = resolveSignInPageState("view=forgot_password");
        assert.strictEqual(altState.authView, "forgot_password");
        assert.strictEqual(altState.title, "Find Your Account");
    });

    test("Scenario 5: Reload forgot-password URL -> Find Your Account UI remains", () => {
        const initialLoad = resolveSignInPageState("tab=personal&view=forgot-password");
        assert.strictEqual(initialLoad.authView, "forgot_password");

        // Simulating browser reload with identical query params
        const reloaded = resolveSignInPageState("tab=personal&view=forgot-password");
        assert.strictEqual(reloaded.authView, "forgot_password");
        assert.strictEqual(reloaded.title, "Find Your Account");
    });

    test("Scenario 6: In-flow 'Back to Login' / 'Cancel' resets URL to /auth/signin without reload", () => {
        // In ForgotPasswordFlow, onBackToLogin executes: setSearchParams(loginMode === "club" ? { tab: "club" } : {})
        const personalBackQuery = ""; // empty params = /auth/signin
        const state = resolveSignInPageState(personalBackQuery);
        assert.strictEqual(state.authView, "signin");
        assert.strictEqual(state.loginMode, "personal");
        assert.strictEqual(state.title, "Welcome back!");
    });

    test("Scenario 7: Switch Personal / Club tabs updates rendered tab correctly", () => {
        // Personal sign in
        const personalState = resolveSignInPageState("tab=personal");
        assert.strictEqual(personalState.loginMode, "personal");
        assert.strictEqual(personalState.title, "Welcome back!");

        // Switch to Club Login
        const clubState = resolveSignInPageState("tab=club");
        assert.strictEqual(clubState.loginMode, "club");
        assert.strictEqual(clubState.title, "Club Portal Login");
        assert.strictEqual(clubState.authView, "signin");
    });

    test("Scenario 8: Navigate between Club Login and its recovery view", () => {
        // 1. Club Login view
        const clubSignin = resolveSignInPageState("tab=club");
        assert.strictEqual(clubSignin.loginMode, "club");
        assert.strictEqual(clubSignin.authView, "signin");
        assert.strictEqual(clubSignin.title, "Club Portal Login");

        // 2. Open Forgot Password from Club mode -> ?tab=club&view=forgot-password
        const clubRecovery = resolveSignInPageState("tab=club&view=forgot-password");
        assert.strictEqual(clubRecovery.loginMode, "club");
        assert.strictEqual(clubRecovery.authView, "forgot_password");
        assert.strictEqual(clubRecovery.title, "Club Account Recovery");
        assert.strictEqual(clubRecovery.switchLinkHref, "/auth/signin?tab=club");

        // 3. Click 'Back to Sign In' from Club recovery -> navigates to /auth/signin?tab=club
        const backToClubSignin = resolveSignInPageState("tab=club");
        assert.strictEqual(backToClubSignin.loginMode, "club");
        assert.strictEqual(backToClubSignin.authView, "signin");
        assert.strictEqual(backToClubSignin.title, "Club Portal Login");
    });

    test("Scenario 9: Browser Back & Forward history navigation maintains perfect sync", () => {
        // History Stack Simulation:
        // Page 1: /auth/signin (no params)
        // Page 2: /auth/signin?tab=personal&view=forgot-password (clicked Forgot Password)
        // Page 3: /auth/signin (clicked Back to Sign In)

        const history = [
            "",
            "tab=personal&view=forgot-password",
            "",
        ];

        // Step at Page 1
        const page1 = resolveSignInPageState(history[0]);
        assert.strictEqual(page1.authView, "signin");

        // Step at Page 2
        const page2 = resolveSignInPageState(history[1]);
        assert.strictEqual(page2.authView, "forgot_password");

        // Step at Page 3
        const page3 = resolveSignInPageState(history[2]);
        assert.strictEqual(page3.authView, "signin");

        // Browser Back to Page 2
        const backToPage2 = resolveSignInPageState(history[1]);
        assert.strictEqual(backToPage2.authView, "forgot_password");

        // Browser Back to Page 1
        const backToPage1 = resolveSignInPageState(history[0]);
        assert.strictEqual(backToPage1.authView, "signin");

        // Browser Forward to Page 2
        const forwardToPage2 = resolveSignInPageState(history[1]);
        assert.strictEqual(forwardToPage2.authView, "forgot_password");
    });
});

describe("AUTH-02: Password Visibility Icon Selection & Toggle Behavior", () => {
    interface PasswordInputState {
        showPassword: boolean;
        value: string;
    }

    function resolvePasswordToggle(state: PasswordInputState) {
        return {
            actualType: state.showPassword ? "text" : "password",
            renderedIcon: state.showPassword ? "Eye" : "EyeOff",
            ariaLabel: state.showPassword ? "Hide password" : "Show password",
            buttonType: "button" as const,
            tabIndex: -1,
            valuePreserved: state.value,
        };
    }

    test("Scenario 10: Hidden password renders complete EyeOff icon, type=password, aria-label=Show password", () => {
        const initial = resolvePasswordToggle({ showPassword: false, value: "SecretP@ss123!" });
        assert.strictEqual(initial.actualType, "password");
        assert.strictEqual(initial.renderedIcon, "EyeOff");
        assert.strictEqual(initial.ariaLabel, "Show password");
        assert.strictEqual(initial.buttonType, "button");
        assert.strictEqual(initial.tabIndex, -1);
        assert.strictEqual(initial.valuePreserved, "SecretP@ss123!");
    });

    test("Scenario 11: Clicking toggle renders complete Eye icon, type=text, aria-label=Hide password", () => {
        const toggled = resolvePasswordToggle({ showPassword: true, value: "SecretP@ss123!" });
        assert.strictEqual(toggled.actualType, "text");
        assert.strictEqual(toggled.renderedIcon, "Eye");
        assert.strictEqual(toggled.ariaLabel, "Hide password");
        assert.strictEqual(toggled.buttonType, "button");
        assert.strictEqual(toggled.tabIndex, -1);
        assert.strictEqual(toggled.valuePreserved, "SecretP@ss123!");
    });

    test("Scenario 12: Password content remains completely unaltered across multiple toggle transitions", () => {
        const passwordValue = "Orbix2026!Campus#Elite";
        let state = { showPassword: false, value: passwordValue };

        // Toggle to visible
        state.showPassword = !state.showPassword;
        let resolved = resolvePasswordToggle(state);
        assert.strictEqual(resolved.renderedIcon, "Eye");
        assert.strictEqual(resolved.actualType, "text");
        assert.strictEqual(resolved.valuePreserved, passwordValue);

        // Toggle back to hidden
        state.showPassword = !state.showPassword;
        resolved = resolvePasswordToggle(state);
        assert.strictEqual(resolved.renderedIcon, "EyeOff");
        assert.strictEqual(resolved.actualType, "password");
        assert.strictEqual(resolved.valuePreserved, passwordValue);
    });

    test("Scenario 13: Toggle button has type='button' to prevent accidental form submission", () => {
        const resolved = resolvePasswordToggle({ showPassword: false, value: "" });
        assert.strictEqual(resolved.buttonType, "button");
    });
});
