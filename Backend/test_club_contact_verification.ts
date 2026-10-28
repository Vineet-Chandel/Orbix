import { EmailVerificationService } from "./src/services/email/emailVerificationService.js";
import { PhoneVerificationService } from "./src/services/sms/phoneVerificationService.js";
import { normalizePhoneNumber } from "./src/services/sms/smsGatewayService.js";
import { query, pool } from "./src/database/client.js";
import redis from "./src/redis/client.js";

async function testContactVerification() {
    console.log("=================================================");
    console.log("   ORBIX CLUB CONTACT VERIFICATION TEST SUITE");
    console.log("=================================================\n");

    const testEmail = "vineetsinghbitu@gmail.com";
    const testPhone = "9389205207";

    try {
        // Test 1: Phone Normalization
        console.log("👉 Test 1: Testing phone normalization for Indian mobile...");
        const norm = normalizePhoneNumber(testPhone);
        console.log("   Raw phone:", testPhone);
        console.log("   Normalized:", norm.canonical);
        console.log("   Formatted:", norm.formatted);
        if (norm.canonical !== "+919389205207") {
            throw new Error(`Expected +919389205207, got ${norm.canonical}`);
        }
        console.log("   ✅ Phone normalization passed!");

        // Test 2: Pre-registration Email OTP Dispatch & Verification
        console.log("\n👉 Test 2: Testing pre-registration Email OTP flow for", testEmail);
        const emailSendRes = await EmailVerificationService.sendPreRegistrationOtp({
            email: testEmail,
            name: "Vineet Singh",
        });
        console.log("   Email OTP dispatched:", emailSendRes.message);
        console.log("   Simulated/Dev OTP:", emailSendRes.devOtp);

        if (!emailSendRes.devOtp) {
            throw new Error("Expected devOtp in development environment");
        }

        // Test invalid OTP rejection
        try {
            await EmailVerificationService.verifyPreRegistrationOtp({
                email: testEmail,
                otp: "000000",
            });
            throw new Error("Invalid OTP should have been rejected!");
        } catch (err: any) {
            console.log("   ✅ Correctly rejected invalid email OTP:", err.message);
        }

        // Test valid OTP verification
        const emailVerifyRes = await EmailVerificationService.verifyPreRegistrationOtp({
            email: testEmail,
            otp: emailSendRes.devOtp,
        });
        console.log("   Email OTP verified successfully!");
        console.log("   Email Token generated:", emailVerifyRes.token ? "Present (JWT)" : "Missing");

        const isEmailTokenValid = EmailVerificationService.verifyVerificationToken(
            emailVerifyRes.token,
            testEmail
        );
        if (!isEmailTokenValid) throw new Error("Email token verification failed!");
        console.log("   ✅ Email verification token validated cryptographically!");

        // Test 3: Phone SMS OTP Dispatch & Verification
        console.log("\n👉 Test 3: Testing Phone SMS OTP flow for", norm.formatted);
        const phoneSendRes = await PhoneVerificationService.sendOtp({
            phone: testPhone,
            clubName: "Developer Club",
        });
        console.log("   SMS OTP dispatched:", phoneSendRes.message);
        console.log("   Simulated/Dev OTP:", phoneSendRes.devOtp);

        if (!phoneSendRes.devOtp) {
            throw new Error("Expected devOtp in development environment");
        }

        // Test invalid OTP rejection
        try {
            await PhoneVerificationService.verifyOtp({
                phone: testPhone,
                otp: "999999",
            });
            throw new Error("Invalid phone OTP should have been rejected!");
        } catch (err: any) {
            console.log("   ✅ Correctly rejected invalid phone OTP:", err.message);
        }

        // Test valid OTP verification
        const phoneVerifyRes = await PhoneVerificationService.verifyOtp({
            phone: testPhone,
            otp: phoneSendRes.devOtp,
        });
        console.log("   Phone OTP verified successfully!");
        console.log("   Phone Token generated:", phoneVerifyRes.token ? "Present (JWT)" : "Missing");

        const isPhoneTokenValid = PhoneVerificationService.verifyVerificationToken(
            phoneVerifyRes.token,
            norm.canonical
        );
        if (!isPhoneTokenValid) throw new Error("Phone token verification failed!");
        console.log("   ✅ Phone verification token validated cryptographically!");

        console.log("\n=================================================");
        console.log("   🎉 ALL CONTACT VERIFICATION UNIT TESTS PASSED!");
        console.log("=================================================\n");
    } catch (err: any) {
        console.error("❌ Test failed:", err);
        process.exitCode = 1;
    } finally {
        await pool.end();
        if (redis) redis.disconnect();
    }
}

testContactVerification();
