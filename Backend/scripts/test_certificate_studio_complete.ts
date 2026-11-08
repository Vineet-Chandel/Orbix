import { query } from "../src/database/client.js";
import { CertificateTemplateService } from "../src/services/club/certificateTemplateService.js";
import { CertificatePdfService } from "../src/services/club/certificatePdfService.js";
import { CertificateIssuanceService, maskEmail } from "../src/services/club/certificateIssuanceService.js";
import { CertificateUploadService } from "../src/services/club/certificateUploadService.js";
import { CertificateCsvService } from "../src/services/club/certificateCsvService.js";
import { CertificateQueueService } from "../src/services/club/certificateQueueService.js";
import type { CertificateDesign, DynamicDataSnapshot } from "../src/types/certificateStudio.js";

async function runTests() {
    console.log("=================================================================");
    console.log("ORBIX CERTIFICATE STUDIO — COMPREHENSIVE INTEGRATION TEST SUITE");
    console.log("=================================================================\n");

    let passed = 0;
    let failed = 0;

    function assert(desc: string, condition: boolean) {
        if (condition) {
            console.log(`  ✅ PASS: ${desc}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${desc}`);
            failed++;
        }
    }

    try {
        // Ensure Phase 12 team unique index matches schema
        await query(`DROP INDEX IF EXISTS unique_club_team_cert_idx;`);
        await query(`CREATE UNIQUE INDEX IF NOT EXISTS unique_club_team_cert_idx ON public.club_certificates (club_id, team_id, COALESCE(event_id, '00000000-0000-0000-0000-000000000000'::uuid), certificate_type, title) WHERE team_id IS NOT NULL AND user_id IS NULL AND claim_token IS NULL;`);

        // -----------------------------------------------------------------
        // TEST 1: System Templates Seeding and Integrity
        // -----------------------------------------------------------------
        console.log("Test 1: System Templates Seeding and Schema Validation");
        await CertificateTemplateService.seedSystemTemplates();
        const testClubRes = await query("SELECT id FROM verified_clubs LIMIT 1;");
        const testClubId = testClubRes.rows[0]?.id || "00000000-0000-0000-0000-000000000001";
        const sysList = await CertificateTemplateService.getTemplates(testClubId);
        assert("System templates library contains at least 25 templates", sysList.systemTemplates.length >= 25);
        
        const sampleTpl = sysList.systemTemplates[0]!;
        assert("Template has valid structured page dimensions", sampleTpl.pageWidth === 842 && sampleTpl.pageHeight === 595);
        assert("Template design contains valid elements array", Array.isArray(sampleTpl.design.elements) && sampleTpl.design.elements.length > 0);
        assert("Template is flagged as system immutable", sampleTpl.isSystem === true);

        // -----------------------------------------------------------------
        // TEST 2: Magic-Byte Upload Validation & SVG Sanitization (Phase 3 & 18)
        // -----------------------------------------------------------------
        console.log("\nTest 2: Security & Magic-Byte Upload Validation");
        
        // Malicious SVG with script and foreignObject
        const maliciousSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
            <script>alert("XSS")</script>
            <foreignObject width="100" height="100"><iframe src="http://attacker.com"></iframe></foreignObject>
            <rect width="800" height="600" fill="#fff"/>
        </svg>`;
        const sanitizedSvg = CertificateUploadService.sanitizeSvg(maliciousSvg);
        assert("SVG sanitization strips <script> tags", !sanitizedSvg.includes("<script"));
        assert("SVG sanitization strips <foreignObject> tags", !sanitizedSvg.includes("<foreignObject"));
        assert("SVG preserves harmless geometry", sanitizedSvg.includes("<rect"));

        // Magic byte validation
        const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
        const formatPng = CertificateUploadService.detectRealFileType(pngHeader);
        assert("Magic bytes accurately identify PNG", formatPng === "png");

        const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
        const formatJpeg = CertificateUploadService.detectRealFileType(jpegHeader);
        assert("Magic bytes accurately identify JPEG", formatJpeg === "jpeg");

        const fakeExe = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ DOS header
        const formatFake = CertificateUploadService.detectRealFileType(fakeExe);
        assert("Malformed / executable binary rejected as unknown", formatFake === "unknown");

        // -----------------------------------------------------------------
        // TEST 3: Authoritative PDF-Lib Rendering & SHA-256 Digest (Phase 9 & 16)
        // -----------------------------------------------------------------
        console.log("\nTest 3: Authoritative Server-Side PDF Rendering & SHA-256 Digest");
        const testDesign: CertificateDesign = {
            page: { width: 842, height: 595, orientation: "landscape", unit: "pt" },
            background: { type: "color", color: "#FAF6EE", borderStyle: "double", borderColor: "#000000", borderWidth: 4 },
            elements: [
                {
                    id: "t1",
                    type: "static-text",
                    x: 50,
                    y: 80,
                    width: 742,
                    height: 50,
                    zIndex: 1,
                    text: "CERTIFICATE OF EXCELLENCE",
                    style: { fontSize: 28, fontWeight: "900", color: "#000000", textAlign: "center" },
                },
                {
                    id: "d1",
                    type: "dynamic-text",
                    x: 80,
                    y: 200,
                    width: 682,
                    height: 60,
                    zIndex: 2,
                    fieldKey: "recipient.name",
                    fitPolicy: "shrink",
                    style: { fontSize: 36, fontWeight: "bold", color: "#000000", textAlign: "center" },
                },
                {
                    id: "qr1",
                    type: "qr-code",
                    x: 50,
                    y: 460,
                    width: 80,
                    height: 80,
                    zIndex: 2,
                    fieldKey: "certificate.credentialCode",
                },
            ],
        };

        const testSnapshot: DynamicDataSnapshot = {
            recipient: {
                id: "test-user-uuid",
                name: "Dr. Shri Venkata Ramana Murthy Ramanathan",
                username: "dr_venkata",
                collegeName: "Delhi Technological University",
            },
            club: {
                id: "test-club-uuid",
                name: "Orbix Developer Society",
                slug: "orbix-dev",
                collegeName: "Delhi Technological University",
            },
            award: {
                title: "Certificate of Excellence",
                type: "excellence",
                description: "Recognizing outstanding architectural mastery.",
                position: "1st Place",
            },
            certificate: {
                credentialCode: "ORB-TEST-2026-X89J",
                issueDate: "November 8, 2026",
                verificationUrl: "https://orbix.dev/verify/certificate/ORB-TEST-2026-X89J",
                signerName: "Prof. Rajesh Verma",
                signerRole: "Faculty Advisor",
            },
        };

        const renderResult = await CertificatePdfService.renderCertificatePdf(testDesign, testSnapshot);
        assert("PDF generated with non-zero byte size", renderResult.pdfBuffer.length > 500);
        assert("SHA-256 digest is exactly 64 hex characters", typeof renderResult.sha256Hash === "string" && renderResult.sha256Hash.length === 64);
        assert("PDF magic bytes start with %PDF-", renderResult.pdfBuffer.subarray(0, 5).toString() === "%PDF-");

        // -----------------------------------------------------------------
        // TEST 4: Database Infrastructure & Audit Logs Table (Phase 17)
        // -----------------------------------------------------------------
        console.log("\nTest 4: Database Infrastructure & Audit Logs");
        const auditTblRes = await query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'certificate_audit_logs';
        `);
        const auditCols = auditTblRes.rows.map((r: any) => r.column_name);
        assert("certificate_audit_logs has actor_user_id column", auditCols.includes("actor_user_id"));
        assert("certificate_audit_logs has action column", auditCols.includes("action"));
        assert("certificate_audit_logs has metadata column", auditCols.includes("metadata"));

        // -----------------------------------------------------------------
        // TEST 5: Extended Category Schema (Phase 10)
        // -----------------------------------------------------------------
        console.log("\nTest 5: Extended Category Schema Support");
        const checkConstraintRes = await query(`
            SELECT conname FROM pg_constraint 
            WHERE conname = 'club_certificates_certificate_type_check';
        `);
        assert("Legacy certificate_type check constraint dropped to support 16 categories", checkConstraintRes.rows.length === 0);

        // -----------------------------------------------------------------
        // TEST 6: Auto-Fit Policies (Wrap, Shrink, Warn) in Server PDF (Phase 9)
        // -----------------------------------------------------------------
        console.log("\nTest 6: Server-Side Auto-Fit Engine (Wrap, Shrink, Warn)");
        const autoFitDesign: CertificateDesign = {
            page: { width: 842, height: 595, orientation: "landscape", unit: "pt" },
            background: { type: "color", color: "#FAF6EE" },
            elements: [
                {
                    id: "wrap-test",
                    type: "dynamic-text",
                    x: 50,
                    y: 100,
                    width: 200,
                    height: 80,
                    zIndex: 1,
                    fieldKey: "award.description",
                    fitPolicy: "wrap",
                    style: { fontSize: 16, textAlign: "left", color: "#000000" },
                },
                {
                    id: "shrink-test",
                    type: "dynamic-text",
                    x: 50,
                    y: 200,
                    width: 200,
                    height: 30,
                    zIndex: 1,
                    fieldKey: "recipient.name",
                    fitPolicy: "shrink",
                    style: { fontSize: 32, textAlign: "left", color: "#000000" },
                },
                {
                    id: "warn-test",
                    type: "dynamic-text",
                    x: 50,
                    y: 300,
                    width: 80,
                    height: 20,
                    zIndex: 1,
                    fieldKey: "recipient.name",
                    fitPolicy: "warn",
                    style: { fontSize: 24, textAlign: "left", color: "#000000" },
                },
            ],
        };

        const autoFitSnapshot: DynamicDataSnapshot = {
            recipient: {
                id: "shrink-user",
                name: "Dr. Sri Sri Sri Venkata Ramanatha Swamy Chidambaram Natarajan",
                username: "dr_swamy",
            },
            club: { id: "club-1", name: "Orbix Club", slug: "orbix" },
            award: {
                title: "Achievement Award",
                type: "achievement",
                description: "This is an extensively detailed achievement award description that will certainly exceed one line and require automatic word wrapping according to Phase 9 specifications.",
            },
            certificate: {
                credentialCode: "ORB-FIT-2026-AUTO",
                issueDate: "November 8, 2026",
                verificationUrl: "https://orbix.dev/verify/certificate/ORB-FIT-2026-AUTO",
                signerName: "Signer Name",
                signerRole: "Signer Role",
            },
        };

        const autoFitResult = await CertificatePdfService.renderCertificatePdf(autoFitDesign, autoFitSnapshot);
        assert("Auto-fit PDF renders successfully with wrap and shrink policies", autoFitResult.pdfBuffer.length > 500);
        assert("Auto-fit engine emits overflow warning for fitPolicy: warn", Array.isArray(autoFitResult.warnings) && autoFitResult.warnings.length > 0);

        // -----------------------------------------------------------------
        // TEST 7: Event Eligibility & 7-Metric Authoritative Audit (Phase 10)
        // -----------------------------------------------------------------
        console.log("\nTest 7: Event Eligibility 7-Metric Authoritative Audit");
        // Check if an existing club and event exist in the DB
        const eventRes = await query(`
            SELECT ce.id as event_id, ce.club_id 
            FROM club_events ce
            LIMIT 1;
        `);

        if (eventRes.rows.length > 0) {
            const { event_id, club_id } = eventRes.rows[0];
            const attendanceReport = await CertificateIssuanceService.evaluateEventEligibility(
                club_id,
                event_id,
                "attendance"
            );

            assert("Eligibility report returns structured metrics object", typeof attendanceReport.summary.totalRegistrations === "number");
            assert("Eligibility report tracks verified attendees", typeof attendanceReport.summary.verifiedAttendeesCount === "number");
            assert("Eligibility report tracks ineligible exclusions", typeof attendanceReport.summary.ineligibleCount === "number");
            assert("Eligibility report returns typed eligibleRecipients array", Array.isArray(attendanceReport.eligibleRecipients));
            assert("Eligibility report returns typed ineligibleRecipients array", Array.isArray(attendanceReport.ineligibleRecipients));
            
            // Check that for attendance, any unverified attendee in exclusions has a descriptive reason
            if (attendanceReport.ineligibleRecipients.length > 0) {
                const sampleExclusion = attendanceReport.ineligibleRecipients[0];
                assert("Exclusions contain human-readable reason", typeof sampleExclusion.exclusionReason === "string" && sampleExclusion.exclusionReason.length > 0);
                assert("Exclusions contain recipient registration ID", typeof sampleExclusion.registrationId === "string");
            }

            // Test participation category comparison
            const participationReport = await CertificateIssuanceService.evaluateEventEligibility(
                club_id,
                event_id,
                "participation"
            );
            assert("Participation eligibility report evaluates correctly", typeof participationReport.summary.eligibleCount === "number");
        } else {
            console.log("  ⚠️ Skipping live DB event check (no club_events present)");
        }

        // -----------------------------------------------------------------
        // TEST 8: Phase 11 Manual Issuance, Directory Privacy & Verified Claim
        // -----------------------------------------------------------------
        console.log("\nTest 8: Phase 11 Manual Issuance, Directory Privacy & Verified Claim");

        // 1. Privacy Email Masking Validation
        const masked1 = maskEmail("aarav.sharma@campus.edu");
        assert("Privacy mask hides middle characters of local part", masked1.startsWith("aa***") && masked1.endsWith("@campus.edu"));
        const masked2 = maskEmail("al@mit.edu");
        assert("Privacy mask handles short usernames", masked2 === "a***@mit.edu");
        const maskedNull = maskEmail(null);
        assert("Privacy mask handles null/empty safely", maskedNull === "***");

        // 2. Recipient Directory Search & Omission of Private Phone Numbers
        const dirClubRes = await query("SELECT id, auth_user_id FROM verified_clubs LIMIT 1;");
        if (dirClubRes.rows.length > 0) {
            const clubId = dirClubRes.rows[0].id;
            const staffUserId = dirClubRes.rows[0].auth_user_id;

            const dirResult = await CertificateIssuanceService.searchRecipientDirectory(clubId, "all", "");
            assert("Recipient directory returns recipients array", Array.isArray(dirResult.recipients));

            // Verify no phone numbers in recipient directory items
            const hasPhoneField = dirResult.recipients.some((r: any) => "phone" in r || "phone_number" in r);
            assert("Global recipient directory strictly omits private phone numbers", !hasPhoneField);

            // 3. Manual Non-Event Batch Issuance with External Claim Recipient
            const testExternalEmail = `external.fellow.${Date.now()}@alumni.org`;
            const manualBatchResult = await CertificateIssuanceService.issueBatch({
                clubId,
                staffUserId,
                title: `Excellence in Open Source Architecture ${Date.now()}`,
                certificateType: "excellence",
                issuanceSource: "manual",
                awardPosition: "Distinguished Fellow",
                description: "Awarded for exceptional architectural leadership outside scheduled event tracks.",
                issueDate: "2026-11-01",
                metadata: {
                    initiative: "Global Open Source 2026",
                    grantAwarded: true,
                },
                recipients: [
                    {
                        isExternal: true,
                        name: "Dr. Evelyn Vance",
                        email: testExternalEmail,
                        customPosition: "Lead Research Fellow",
                    },
                ],
            });

            assert("Manual batch issues successfully without event linking", manualBatchResult.successfulCount === 1);
            const issuedCert = manualBatchResult.issuedCertificates[0];
            assert("External recipient receives secure claim token", typeof issuedCert?.claimToken === "string" && issuedCert.claimToken.length >= 32);

            // 4. Verify Claim Endpoint Details
            const claimDetails = await CertificateIssuanceService.getClaimDetails(issuedCert!.claimToken!);
            assert("Claim endpoint retrieves valid record", claimDetails !== null && claimDetails.recipientName === "Dr. Evelyn Vance");
            assert("Claim endpoint masks external email", Boolean(claimDetails?.recipientEmailMasked.includes("***")));
            assert("Claim status is pending_claim", claimDetails?.claimStatus === "pending_claim");

            // 5. Authenticated Claim Workflow
            const claimResult = await CertificateIssuanceService.claimCertificate(issuedCert!.claimToken!, staffUserId);
            assert("Claiming binds certificate to user profile", claimResult.credentialCode === issuedCert?.credentialCode);

            // Re-fetching claim details now reflects 'claimed'
            const recheckClaim = await CertificateIssuanceService.getClaimDetails(issuedCert!.claimToken!);
            assert("Claim status transitions to claimed", recheckClaim?.claimStatus === "claimed");

            // -----------------------------------------------------------------
            // TEST 9: Phase 12 Team Roster Review & Team-Only Issuance
            // -----------------------------------------------------------------
            console.log("\nTest 9: Phase 12 Team Roster Review & Team-Only Issuance");

            // Create fresh test team with active member for deterministic testing
            const testTimestamp = Date.now();
            const testTeamSlug = `orbix-auto-sys-${testTimestamp}`;
            const testTeamName = `Orbix Autonomous Systems Team ${testTimestamp}`;
            const teamIns = await query(
                `INSERT INTO club_teams (club_id, name, slug, description, created_by)
                 VALUES ($1, $2, $3, 'Core engineering robotics team', $4)
                 RETURNING id, name;`,
                [clubId, testTeamName, testTeamSlug, staffUserId]
            );
            const testTeamId = teamIns.rows[0].id;

            // Fetch or insert club membership for staffUserId
            const memRes = await query(
                `SELECT id FROM club_memberships WHERE club_id = $1 AND user_id = $2 LIMIT 1;`,
                [clubId, staffUserId]
            );
            let membershipId = memRes.rows[0]?.id;
            if (!membershipId) {
                const memIns = await query(
                    `INSERT INTO club_memberships (club_id, user_id, club_role, access_role, status)
                     VALUES ($1, $2, 'Coordinator', 'ADMIN', 'active')
                     RETURNING id;`,
                    [clubId, staffUserId]
                );
                membershipId = memIns.rows[0].id;
            }

            await query(
                `INSERT INTO club_team_members (club_id, team_id, user_id, club_membership_id, team_role, position_title, status)
                 VALUES ($1, $2, $3, $4, 'Lead Architect', 'Team Captain', 'active');`,
                [clubId, testTeamId, staffUserId, membershipId]
            );

            // Test 9.1: Authoritative Team Roster Review
            const roster = await CertificateIssuanceService.getTeamRosterForReview(clubId, testTeamId);
            assert("Team roster review returns team metadata", roster.teamId === testTeamId);
            assert("Team roster includes memberCount", typeof roster.memberCount === "number");
            assert("Team roster contains typed members array", Array.isArray(roster.members));

            // Test 9.2: Team-Only Certificate Issuance
            const teamBatchResult = await CertificateIssuanceService.issueBatch({
                clubId,
                staffUserId,
                title: `Robotics Championship First Place ${Date.now()}`,
                certificateType: "winner",
                issuanceSource: "team",
                teamId: testTeamId,
                awardPosition: "Champions",
                description: "Awarded to the entire team for first place in Autonomous Systems.",
                teamIssuanceMode: "team_only",
                recipients: [],
            });

            assert("Team-only batch issues successfully", teamBatchResult.successfulCount === 1);
            assert("Team certificates count is exactly 1", teamBatchResult.teamCertificatesCount === 1);
            assert("Individual certificates count is 0 in team-only mode", teamBatchResult.individualCertificatesCount === 0);

            const issuedTeamCert = teamBatchResult.issuedCertificates[0];
            assert("Issued certificate flagged as isTeam", issuedTeamCert.isTeam === true);
            assert("Issued certificate associates teamId", issuedTeamCert.teamId === testTeamId);

            // Verify in database: user_id is NULL and team_id is set
            const dbTeamCert = await query(
                `SELECT user_id, team_id, recipient_snapshot FROM club_certificates WHERE id = $1;`,
                [issuedTeamCert.id]
            );
            assert("Database record has user_id = NULL for collective team credential", dbTeamCert.rows[0].user_id === null);
            assert("Database record has team_id set", dbTeamCert.rows[0].team_id === testTeamId);
            assert("Database record recipient_snapshot preserves frozen team snapshot", Boolean(dbTeamCert.rows[0].recipient_snapshot?.team?.memberSnapshot));

            // -----------------------------------------------------------------
            // TEST 10: Phase 12 Dual Mode ("both") & Authoritative Deduplication
            // -----------------------------------------------------------------
            console.log("\nTest 10: Phase 12 Dual Mode ('both') & Authoritative Deduplication");

            // Setup a scenario with user overlap:
            // Team snapshot has staffUserId + external user
            // Direct recipients also includes staffUserId (duplicate)
            const dualTitle = `Dual Honors & Innovation Fellowship ${Date.now()}`;
            const dualBatchResult = await CertificateIssuanceService.issueBatch({
                clubId,
                staffUserId,
                title: dualTitle,
                certificateType: "best_innovation",
                issuanceSource: "team",
                awardPosition: "Lead Innovator",
                teamIssuanceMode: "both",
                teamSnapshots: [
                    {
                        teamId: testTeamId,
                        teamName: testTeamName,
                        members: [
                            {
                                userId: staffUserId,
                                name: "Staff Engineer",
                                role: "Team Lead",
                                customPosition: "Captain",
                            },
                            {
                                isExternal: true,
                                name: "Rohan Guest",
                                email: `guest.rohan.${Date.now()}@test.org`,
                                role: "Hardware Specialist",
                                customPosition: "Hardware Lead",
                            },
                        ],
                    },
                ],
                recipients: [
                    // Direct duplicate of staffUserId
                    {
                        userId: staffUserId,
                        customName: "Staff Engineer (Direct Selection)",
                        customPosition: "Innovation Fellow",
                    },
                ],
            });

            assert("Dual batch issues both team and individual credentials", dualBatchResult.successfulCount >= 3);
            assert("Dual batch issues exactly 1 team credential", dualBatchResult.teamCertificatesCount === 1);
            assert("Dual batch issues individual credentials", (dualBatchResult.individualCertificatesCount || 0) >= 2);
            assert("Deduplication engine detects and consolidates overlapping user", (dualBatchResult.deduplicatedCount || 0) >= 1);

            // -----------------------------------------------------------------
            // TEST 11: Phase 12 Public Verification with Team Snapshot
            // -----------------------------------------------------------------
            console.log("\nTest 11: Phase 12 Public Verification with Team Snapshot");

            const teamVerifyRes = await query(
                `SELECT
                    c.id, c.credential_code, c.recipient_snapshot, c.team_id, c.user_id,
                    vc.name AS "clubName"
                 FROM club_certificates c
                 JOIN verified_clubs vc ON vc.id = c.club_id
                 WHERE c.id = $1;`,
                [issuedTeamCert.id]
            );

            const vCert = teamVerifyRes.rows[0];
            const isTeamCert = !vCert.user_id && Boolean(vCert.team_id);
            assert("Verification accurately recognizes team credential", isTeamCert === true);
            const verifiedMembers = vCert.recipient_snapshot?.team?.memberSnapshot;
            assert("Verification exposes frozen team roster snapshot", Array.isArray(verifiedMembers) && verifiedMembers.length > 0);
            const memberNames = verifiedMembers.map((m: any) => m.name);
            assert("Roster snapshot contains team member names", memberNames.length > 0);
        }

        // =========================================================================
        // Test 12: Phase 14 CSV Import, Formula Injection Neutralization, and Campus Reconciliation
        // =========================================================================
        console.log("\nTest 12: Phase 14 CSV Import, Formula Injection Neutralization, and Campus Reconciliation");
        {
            // 1. Formula Injection Sanitization Tests (CWE-1236)
            assert("Formula sanitization neutralizes = prefix", CertificateCsvService.sanitizeCsvField("=SUM(A1:B10)") === "'=SUM(A1:B10)");
            assert("Formula sanitization neutralizes + prefix", CertificateCsvService.sanitizeCsvField("+1234567890") === "'+1234567890");
            assert("Formula sanitization neutralizes - prefix", CertificateCsvService.sanitizeCsvField("-cmd|' /C calc'!A0") === "'-cmd|' /C calc'!A0");
            assert("Formula sanitization neutralizes @ prefix", CertificateCsvService.sanitizeCsvField("@echo off") === "'@echo off");
            assert("Formula sanitization neutralizes tab prefix", CertificateCsvService.sanitizeCsvField("\tbadcommand") === "'badcommand");
            assert("Formula sanitization leaves harmless strings intact", CertificateCsvService.sanitizeCsvField("Aarav Sharma") === "Aarav Sharma");

            // 2. CSV Parser with quotes and multi-columns
            const testCsvString = `Full Name,Email Address,Role Track,Award Position\n"Doe, Jane",jane.doe@campus.edu,"AI, ML",First Place\n=cmd|calc,attacker@exploit.org,Hacker,None\n"Sharma, Aarav",aarav@campus.edu,Backend,Runner Up`;
            const parsed = CertificateCsvService.parseCsv(testCsvString);
            assert("CSV parser extracts headers accurately", parsed.headers.length === 4);
            assert("CSV parser extracts rows correctly", parsed.rows.length === 3);
            assert("CSV parser handles commas inside quotes", parsed.rows[0]?.["full name"] === "Doe, Jane");

            // 3. Column Auto-Detection
            const cols = CertificateCsvService.detectColumns(parsed.headers);
            assert("Column detector finds name column", Boolean(cols.nameCol));
            assert("Column detector finds email column", Boolean(cols.emailCol));
            assert("Column detector finds role column", Boolean(cols.roleCol));
            assert("Column detector finds position column", Boolean(cols.positionCol));

            // 4. Reconciliation Engine against DB
            const staffUserRes = await query("SELECT email, username, firstname FROM users LIMIT 1;");
            const staffEmail = staffUserRes.rows[0]?.email || "registered@campus.edu";
            const extEmail = `external.winner.${Date.now()}@partner.org`;

            const reconciliationCsv = [
                "name,email,role,position",
                `"Registered Campus Student",${staffEmail},Participant,Gold`,
                `"External Contributor",${extEmail},Mentor,Keynote`,
                `"Duplicate Student",${staffEmail},Participant,Silver`,
                `"Malformed Row",invalid-email-format,Observer,`,
            ].join("\n");

            const clubId = dirClubRes.rows[0]?.id;
            const reconResult = await CertificateCsvService.reconcileCsv({
                clubId,
                csvContent: reconciliationCsv,
            });

            assert("Reconciliation parses all 4 rows", reconResult.totalRows === 4);
            assert("Reconciliation identifies registered Orbix student", reconResult.matchedStudentsCount >= 1);
            assert("Reconciliation identifies external recipient", reconResult.externalCount === 1);
            assert("Reconciliation identifies invalid/duplicate rows", reconResult.invalidCount === 2);
            assert("Reconciliation flags duplicate email within CSV", reconResult.duplicateCount === 1);
            assert("Matched student row has status matched_student", reconResult.rows[0]?.status === "matched_student");
            assert("Matched student has verified user profile details", Boolean(reconResult.rows[0]?.matchedUser?.id));
            assert("External recipient row has status external_recipient", reconResult.rows[1]?.status === "external_recipient");
            assert("Invalid row contains validation errors", (reconResult.rows[3]?.validationErrors?.length || 0) > 0);
        }

        // =========================================================================
        // Test 13: Phase 13 Asynchronous Batch Queue, Rate Limiting, and Progress Tracking
        // =========================================================================
        console.log("\nTest 13: Phase 13 Asynchronous Batch Queue, Rate Limiting, and Progress Tracking");
        {
            const clubId = dirClubRes.rows[0]?.id;
            const staffUserId = dirClubRes.rows[0]?.auth_user_id;

            // 1. Rate Limiting Check
            const isAllowed = CertificateQueueService.checkRateLimit(clubId, 100);
            assert("Rate limiter allows legitimate submission", isAllowed === true);

            // 2. Idempotency Key Deduplication
            const idempotencyKey = `idemp-${Date.now()}-${Math.random()}`;
            const asyncBatchTitle = `Async High-Throughput Batch ${Date.now()}`;

            const asyncReq = {
                clubId,
                staffUserId,
                title: asyncBatchTitle,
                certificateType: "excellence",
                issuanceSource: "manual" as const,
                asyncMode: true,
                idempotencyKey,
                recipients: [
                    { name: "Async Student Alpha", email: `async.alpha.${Date.now()}@campus.edu` },
                    { name: "Async Student Beta", email: `async.beta.${Date.now()}@campus.edu` },
                ],
            };

            const asyncRes1 = await CertificateIssuanceService.issueBatch(asyncReq);
            assert("Async issuance returns isAsync flag", asyncRes1.isAsync === true);
            assert("Async issuance returns queued status", asyncRes1.status === "queued");
            assert("Async issuance returns batchId immediately", Boolean(asyncRes1.batchId));

            // Second submission with same idempotency key
            const asyncRes2 = await CertificateIssuanceService.issueBatch(asyncReq);
            assert("Idempotency deduplication returns existing batchId", asyncRes2.batchId === asyncRes1.batchId);

            // 3. Progress Tracking
            const initialProgress = await CertificateQueueService.getBatchProgress(asyncRes1.batchId, clubId);
            assert("Progress tracker returns valid batch record", Boolean(initialProgress));
            assert("Progress tracker reports totalRecipients = 2", initialProgress?.totalRecipients === 2);
            assert("Progress tracker provides throughput metric", typeof initialProgress?.currentThroughput === "number");

            // Wait briefly for background worker execution
            await new Promise((resolve) => setTimeout(resolve, 2000));

            const completedProgress = await CertificateQueueService.getBatchProgress(asyncRes1.batchId, clubId);
            assert("Worker completes background batch processing", completedProgress?.status === "completed");
            assert("Worker records successful count = 2", completedProgress?.successfulCount === 2);
            assert("Worker records failed count = 0", completedProgress?.failedCount === 0);
            assert("Progress percentage reaches 100%", completedProgress?.progressPercentage === 100);
        }

        // =========================================================================
        // Test 14: Phase 13 Partial Batch Recovery
        // =========================================================================
        console.log("\nTest 14: Phase 13 Partial Batch Recovery");
        {
            const clubId = dirClubRes.rows[0]?.id;
            const staffUserId = dirClubRes.rows[0]?.auth_user_id;

            // Create a batch with a simulated failure state
            const failedBatchTitle = `Partially Recoverable Batch ${Date.now()}`;
            const recoveryBatchRes = await CertificateIssuanceService.issueBatch({
                clubId,
                staffUserId,
                title: failedBatchTitle,
                certificateType: "appreciation",
                issuanceSource: "manual",
                recipients: [
                    { name: "Recoverable Student 1", email: `rec1.${Date.now()}@campus.edu` },
                ],
            });

            // Simulate partial failure in DB
            await query(
                `UPDATE certificate_batches SET
                    status = 'partially_failed',
                    failed_count = 1,
                    error_log = '[{"recipientName":"Recoverable Student 2","email":"rec2@campus.edu","error":"Simulated worker timeout"}]'::jsonb
                 WHERE id = $1;`,
                [recoveryBatchRes.batchId]
            );

            const preRecovery = await CertificateQueueService.getBatchProgress(recoveryBatchRes.batchId, clubId);
            assert("Batch identified as recoverable", preRecovery?.isRecoverable === true);
            assert("Batch canRetry flag is true", preRecovery?.canRetry === true);

            // Trigger partial batch recovery
            const retryRes = await CertificateQueueService.retryFailedBatch(recoveryBatchRes.batchId, clubId, staffUserId);
            assert("Partial recovery succeeds without throwing", retryRes.success === true);
        }

        console.log("\n=================================================================");
        console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
        console.log("=================================================================\n");

        if (failed > 0) {
            process.exit(1);
        } else {
            process.exit(0);
        }
    } catch (err: any) {
        console.error("Test execution failed:", err);
        process.exit(1);
    }
}

runTests();
