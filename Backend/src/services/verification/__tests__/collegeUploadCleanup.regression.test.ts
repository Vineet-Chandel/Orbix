import assert from "node:assert/strict";
import redis from "../../../redis/client.js";
import { CollegeVerificationService, type StoredDocument } from "../collegeVerificationService.js";

async function runRegressionTests() {
    console.log("=================================================");
    console.log("🧪 ORBIX COLLEGE VERIFICATION STAGE 3.8A REGRESSION SUITE");
    console.log("   (100% Mocked, Isolated, Zero Database Pollution)");
    console.log("=================================================\n");

    let passedTests = 0;
    let failedTests = 0;

    function recordPass(testName: string) {
        console.log(`  ✅ PASS: ${testName}`);
        passedTests++;
    }

    function recordFail(testName: string, err: any) {
        console.error(`  ❌ FAIL: ${testName}`);
        console.error(`     Error: ${err.message || err}`);
        failedTests++;
    }

    // Authentic image buffers exceeding MIN_FILE_SIZE (100 bytes)
    const validPngBuffer = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(250, 0x41),
    ]);
    const validJpegBuffer = Buffer.concat([
        Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
        Buffer.alloc(250, 0x42),
    ]);
    const validWebpBuffer = Buffer.concat([
        Buffer.from([0x52, 0x49, 0x46, 0x46]), // 'RIFF'
        Buffer.from([0x00, 0x01, 0x00, 0x00]), // chunk size
        Buffer.from([0x57, 0x45, 0x42, 0x50]), // 'WEBP'
        Buffer.alloc(250, 0x43),
    ]);
    const corruptBuffer = Buffer.concat([
        Buffer.from("corrupt_non_image_payload_that_fails_ocr_magic_bytes_validation_completely"),
        Buffer.alloc(150, 0x5a),
    ]);

    const userId = "u-student-001";
    const collegeId = "inst-iitk-100";
    const defaultContact = {
        institutionEmail: "aarav@iitk.ac.in",
        phoneNumber: "9876543210",
    };

    function createMockQuery(options: { insertFails?: boolean; customError?: string } = {}) {
        const queryCalls: Array<{ text: string; params?: any[] | undefined }> = [];
        const verifiedAt = new Date();

        const queryFn = async (text: string, params?: any[]) => {
            queryCalls.push({ text, params });

            if (text.includes("FROM users")) {
                return { rows: [{ id: userId, college_id: collegeId, college: "IIT Kanpur", account_type: "personal" }] };
            }
            if (text.includes("FROM institutions")) {
                return { rows: [{ id: collegeId, official_name: "IIT Kanpur", website: "https://iitk.ac.in" }] };
            }
            if (text.includes("FROM college_verifications WHERE user_id")) {
                return { rows: [] }; // no pending applications
            }
            if (text.includes("FROM college_verification_email_tokens")) {
                return {
                    rows: [
                        {
                            id: "tok-verified-1",
                            institution_email: "aarav@iitk.ac.in",
                            verified_at: verifiedAt,
                        },
                    ],
                };
            }
            if (text.includes("FROM college_verification_phone_otps")) {
                return {
                    rows: [
                        {
                            id: "otp-verified-1",
                            phone: "+919876543210",
                            verified_at: verifiedAt,
                        },
                    ],
                };
            }
            if (text.includes("UPDATE college_verification_email_tokens")) {
                return { rows: [{ id: "tok-verified-1" }] };
            }
            if (text.includes("UPDATE college_verification_phone_otps")) {
                return { rows: [{ id: "otp-verified-1" }] };
            }
            if (text.includes("INSERT INTO college_verifications")) {
                if (options.insertFails) {
                    throw new Error(options.customError || "Database connection dropped during INSERT INTO college_verifications");
                }
                return {
                    rows: [
                        {
                            id: "cv-uuid-999",
                            user_id: userId,
                            college_id: collegeId,
                            status: "PENDING",
                            document_type: params?.[2] || "student_id",
                            document_paths: params?.[3] ? JSON.parse(params[3]) : [],
                            institution_email: params?.[10] || null,
                            email_verified_at: params?.[11] || null,
                            phone_number: params?.[12] || null,
                            phone_verified_at: params?.[13] || null,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        },
                    ],
                };
            }

            return { rows: [] };
        };

        return { queryFn, queryCalls };
    }

    interface MockUploaderOptions {
        failOnUploadIndex?: number;
        uploadErrorMessage?: string;
        failOnDestroyIds?: string[];
        destroyErrorMessage?: string;
    }

    function createMockUploader(options: MockUploaderOptions = {}) {
        let uploadCounter = 0;
        const uploadedAssetIds: string[] = [];
        const deletedAssetIds: string[] = [];
        const destroyCalls: Array<{ publicId: string; options: any }> = [];

        const uploader = {
            upload_stream: (uploadOpts: any, callback: (error: any, result: any) => void) => {
                uploadCounter++;
                const currentIndex = uploadCounter;

                return {
                    end: (buffer: Buffer) => {
                        if (options.failOnUploadIndex && options.failOnUploadIndex === currentIndex) {
                            return callback(new Error(options.uploadErrorMessage || `Cloudinary stream error on upload #${currentIndex}`), null);
                        }

                        const publicId = `${uploadOpts.folder || "orbix/college_verifications"}/test_asset_${currentIndex}`;
                        uploadedAssetIds.push(publicId);

                        callback(null, {
                            public_id: publicId,
                            bytes: buffer.length,
                            format: uploadOpts.format || "jpg",
                        });
                    },
                };
            },

            destroy: async (publicId: string, destroyOpts: any) => {
                destroyCalls.push({ publicId, options: destroyOpts });

                if (options.failOnDestroyIds && options.failOnDestroyIds.includes(publicId)) {
                    throw new Error(options.destroyErrorMessage || `Cloudinary API error destroying ${publicId}`);
                }

                deletedAssetIds.push(publicId);
                return { result: "ok" };
            },
        };

        return { uploader, uploadedAssetIds, deletedAssetIds, destroyCalls };
    }

    // --------------------------------------------------------------------------------------------------
    // TEST 1: First document upload fails: no deletion should be attempted.
    // --------------------------------------------------------------------------------------------------
    try {
        const { queryFn } = createMockQuery();
        const { uploader, deletedAssetIds, destroyCalls } = createMockUploader({
            failOnUploadIndex: 1,
            uploadErrorMessage: "Network timeout on first file upload",
        });

        await assert.rejects(
            async () => {
                await CollegeVerificationService.submitApplication(
                    {
                        userId,
                        collegeId,
                        documentType: "student_id",
                        ...defaultContact,
                        files: [{ buffer: validPngBuffer, originalname: "front_id.png", mimetype: "image/png", size: validPngBuffer.length }],
                    },
                    {
                        query: queryFn,
                        uploader,
                        isCloudinaryConfigured: () => true,
                    }
                );
            },
            /Network timeout on first file upload/,
            "Should reject with primary upload error"
        );

        assert.equal(destroyCalls.length, 0, "No destroy call should be made when first upload fails");
        assert.equal(deletedAssetIds.length, 0, "No asset ID should be deleted when zero files succeeded");
        recordPass("1. First document upload fails: no deletion should be attempted");
    } catch (err: any) {
        recordFail("1. First document upload fails: no deletion should be attempted", err);
    }

    // --------------------------------------------------------------------------------------------------
    // TEST 2: First upload succeeds, second upload fails: first asset is deleted.
    // --------------------------------------------------------------------------------------------------
    try {
        const { queryFn } = createMockQuery();
        const { uploader, deletedAssetIds, destroyCalls } = createMockUploader({
            failOnUploadIndex: 2,
            uploadErrorMessage: "Cloudinary 503 Service Unavailable on second file",
        });

        await assert.rejects(
            async () => {
                await CollegeVerificationService.submitApplication(
                    {
                        userId,
                        collegeId,
                        documentType: "student_id_both_sides",
                        ...defaultContact,
                        files: [
                            { buffer: validPngBuffer, originalname: "front.png", mimetype: "image/png", size: validPngBuffer.length },
                            { buffer: validJpegBuffer, originalname: "back.jpg", mimetype: "image/jpeg", size: validJpegBuffer.length },
                        ],
                    },
                    {
                        query: queryFn,
                        uploader,
                        isCloudinaryConfigured: () => true,
                    }
                );
            },
            /Cloudinary 503 Service Unavailable on second file/
        );

        const expectedDeletedId = "orbix/college_verifications/test_asset_1";
        assert.equal(destroyCalls.length, 1, "Exactly one destroy call should be made");
        assert.equal(destroyCalls[0]?.publicId, expectedDeletedId, "Exact asset identifier of first file must be deleted");
        assert.equal(destroyCalls[0]?.options?.type, "authenticated", "Authenticated mode must be specified for private college ID assets");
        assert.deepEqual(deletedAssetIds, [expectedDeletedId], "Deleted IDs must match exact first asset ID");
        recordPass("2. First upload succeeds, second upload fails: first asset is deleted");
    } catch (err: any) {
        recordFail("2. First upload succeeds, second upload fails: first asset is deleted", err);
    }

    // --------------------------------------------------------------------------------------------------
    // TEST 3: Multiple uploads succeed, final upload fails: every earlier asset is targeted for deletion.
    // --------------------------------------------------------------------------------------------------
    try {
        const { queryFn } = createMockQuery();
        const { uploader, deletedAssetIds, destroyCalls } = createMockUploader({
            failOnUploadIndex: 3,
            uploadErrorMessage: "Storage quota exceeded on 3rd file",
        });

        await assert.rejects(
            async () => {
                await CollegeVerificationService.submitApplication(
                    {
                        userId,
                        collegeId,
                        documentType: "student_id",
                        ...defaultContact,
                        files: [
                            { buffer: validPngBuffer, originalname: "doc_1.png", mimetype: "image/png", size: validPngBuffer.length },
                            { buffer: validJpegBuffer, originalname: "doc_2.jpg", mimetype: "image/jpeg", size: validJpegBuffer.length },
                            { buffer: validWebpBuffer, originalname: "doc_3.webp", mimetype: "image/webp", size: validWebpBuffer.length },
                        ],
                    },
                    {
                        query: queryFn,
                        uploader,
                        isCloudinaryConfigured: () => true,
                    }
                );
            },
            /Storage quota exceeded on 3rd file/
        );

        const expectedIds = ["orbix/college_verifications/test_asset_1", "orbix/college_verifications/test_asset_2"];
        assert.equal(destroyCalls.length, 2, "Destroy must be called for all earlier successful uploads");
        assert.deepEqual(
            destroyCalls.map((c) => c.publicId),
            expectedIds,
            "Destroy must target exact identifiers of doc_1 and doc_2"
        );
        assert.deepEqual(deletedAssetIds, expectedIds);
        recordPass("3. Multiple uploads succeed, final upload fails: every earlier asset is targeted for deletion");
    } catch (err: any) {
        recordFail("3. Multiple uploads succeed, final upload fails: every earlier asset is targeted for deletion", err);
    }

    // --------------------------------------------------------------------------------------------------
    // TEST 4: One cleanup deletion fails: cleanup still attempts deletion of all remaining assets.
    // --------------------------------------------------------------------------------------------------
    try {
        const { queryFn } = createMockQuery();
        // Asset 1 deletion throws an error; Asset 2 deletion should still be attempted and succeed!
        const { uploader, deletedAssetIds, destroyCalls } = createMockUploader({
            failOnUploadIndex: 3,
            failOnDestroyIds: ["orbix/college_verifications/test_asset_1"],
            destroyErrorMessage: "Rate limit on Cloudinary destroy API for asset 1",
        });

        await assert.rejects(
            async () => {
                await CollegeVerificationService.submitApplication(
                    {
                        userId,
                        collegeId,
                        documentType: "student_id",
                        ...defaultContact,
                        files: [
                            { buffer: validPngBuffer, originalname: "doc_1.png", mimetype: "image/png", size: validPngBuffer.length },
                            { buffer: validJpegBuffer, originalname: "doc_2.jpg", mimetype: "image/jpeg", size: validJpegBuffer.length },
                            { buffer: validWebpBuffer, originalname: "doc_3.webp", mimetype: "image/webp", size: validWebpBuffer.length },
                        ],
                    },
                    {
                        query: queryFn,
                        uploader,
                        isCloudinaryConfigured: () => true,
                    }
                );
            },
            /Cloudinary stream error on upload #3/
        );

        // Both assets were targeted for destruction
        assert.equal(destroyCalls.length, 2, "Both assets must be targeted despite asset 1 deletion failure");
        assert.equal(destroyCalls[0]?.publicId, "orbix/college_verifications/test_asset_1");
        assert.equal(destroyCalls[1]?.publicId, "orbix/college_verifications/test_asset_2");
        // Asset 2 was successfully cleaned up despite asset 1 failure
        assert.deepEqual(deletedAssetIds, ["orbix/college_verifications/test_asset_2"]);
        recordPass("4. One cleanup deletion fails: cleanup still attempts deletion of all remaining assets");
    } catch (err: any) {
        recordFail("4. One cleanup deletion fails: cleanup still attempts deletion of all remaining assets", err);
    }

    // --------------------------------------------------------------------------------------------------
    // TEST 5: Database persistence fails after all uploads: every newly uploaded asset is targeted for deletion.
    // --------------------------------------------------------------------------------------------------
    try {
        const { queryFn } = createMockQuery({
            insertFails: true,
            customError: "PostgreSQL constraint violation: duplicate active application",
        });
        const { uploader, deletedAssetIds, destroyCalls } = createMockUploader();

        await assert.rejects(
            async () => {
                await CollegeVerificationService.submitApplication(
                    {
                        userId,
                        collegeId,
                        documentType: "student_id_both_sides",
                        ...defaultContact,
                        files: [
                            { buffer: validPngBuffer, originalname: "front.png", mimetype: "image/png", size: validPngBuffer.length },
                            { buffer: validJpegBuffer, originalname: "back.jpg", mimetype: "image/jpeg", size: validJpegBuffer.length },
                        ],
                    },
                    {
                        query: queryFn,
                        uploader,
                        isCloudinaryConfigured: () => true,
                    }
                );
            },
            /PostgreSQL constraint violation/
        );

        const expectedIds = ["orbix/college_verifications/test_asset_1", "orbix/college_verifications/test_asset_2"];
        assert.equal(destroyCalls.length, 2, "All uploaded assets must be cleaned up when database insert fails");
        assert.deepEqual(deletedAssetIds, expectedIds, "All newly uploaded assets must be deleted from Cloudinary");
        recordPass("5. Database persistence fails after all uploads: every newly uploaded asset is targeted for deletion");
    } catch (err: any) {
        recordFail("5. Database persistence fails after all uploads: every newly uploaded asset is targeted for deletion", err);
    }

    // --------------------------------------------------------------------------------------------------
    // TEST 6: Database transaction succeeds: uploaded assets are retained.
    // --------------------------------------------------------------------------------------------------
    try {
        const { queryFn } = createMockQuery({ insertFails: false });
        const { uploader, deletedAssetIds, destroyCalls, uploadedAssetIds } = createMockUploader();

        const result = await CollegeVerificationService.submitApplication(
            {
                userId,
                collegeId,
                documentType: "student_id_both_sides",
                ...defaultContact,
                files: [
                    { buffer: validPngBuffer, originalname: "front.png", mimetype: "image/png", size: validPngBuffer.length },
                    { buffer: validJpegBuffer, originalname: "back.jpg", mimetype: "image/jpeg", size: validJpegBuffer.length },
                ],
            },
            {
                query: queryFn,
                uploader,
                isCloudinaryConfigured: () => true,
            }
        );

        assert.equal(result.success, true, "Submission must succeed");
        assert.equal(uploadedAssetIds.length, 2, "Two assets uploaded");
        assert.equal(destroyCalls.length, 0, "No destroy call should be made on successful persistence");
        assert.equal(deletedAssetIds.length, 0, "No uploaded assets must be deleted when submission succeeds");
        recordPass("6. Database transaction succeeds: uploaded assets are retained");
    } catch (err: any) {
        recordFail("6. Database transaction succeeds: uploaded assets are retained", err);
    }

    // --------------------------------------------------------------------------------------------------
    // TEST 7: Cleanup fails: original submission error remains the primary error.
    // --------------------------------------------------------------------------------------------------
    try {
        const primaryError = "Primary error: Tesseract OCR format validation rejected file";
        const { queryFn } = createMockQuery();
        // File 1 succeeds, File 2 is corrupt. During cleanup of File 1, Cloudinary destroy fails!
        const { uploader } = createMockUploader({
            failOnDestroyIds: ["orbix/college_verifications/test_asset_1"],
            destroyErrorMessage: "Secondary Cloudinary destroy failure: network down",
        });

        await assert.rejects(
            async () => {
                await CollegeVerificationService.submitApplication(
                    {
                        userId,
                        collegeId,
                        documentType: "student_id_both_sides",
                        ...defaultContact,
                        files: [
                            { buffer: validPngBuffer, originalname: "front.png", mimetype: "image/png", size: validPngBuffer.length },
                            { buffer: corruptBuffer, originalname: "back.png", mimetype: "image/png", size: corruptBuffer.length },
                        ],
                    },
                    {
                        query: queryFn,
                        uploader,
                        isCloudinaryConfigured: () => true,
                    }
                );
            },
            (err: any) => {
                // Must preserve the primary error, NOT the cleanup error
                assert.ok(!err.message.includes("Secondary Cloudinary destroy failure"), "Cleanup error must NOT mask primary error");
                assert.ok(
                    err.message.includes("Unsupported file type") ||
                    err.message.includes("Invalid file format") ||
                    err.message.includes("empty or corrupted"),
                    "Primary validation error must be preserved"
                );
                return true;
            }
        );

        recordPass("7. Cleanup fails: original submission error remains the primary error");
    } catch (err: any) {
        recordFail("7. Cleanup fails: original submission error remains the primary error", err);
    }

    // --------------------------------------------------------------------------------------------------
    // TEST 8: No pre-existing or unrelated Cloudinary asset is deleted.
    // --------------------------------------------------------------------------------------------------
    try {
        const { queryFn } = createMockQuery({ insertFails: true });
        const { uploader, destroyCalls } = createMockUploader();

        const unrelatedAssetId = "orbix/college_verifications/unrelated_user_doc_999999";

        await assert.rejects(async () => {
            await CollegeVerificationService.submitApplication(
                {
                    userId,
                    collegeId,
                    documentType: "student_id",
                    ...defaultContact,
                    files: [{ buffer: validPngBuffer, originalname: "user_a.png", mimetype: "image/png", size: validPngBuffer.length }],
                },
                {
                    query: queryFn,
                    uploader,
                    isCloudinaryConfigured: () => true,
                }
            );
        });

        const targetedIds = destroyCalls.map((c) => c.publicId);
        assert.ok(!targetedIds.includes(unrelatedAssetId), "Unrelated asset must never be targeted for deletion");
        assert.deepEqual(targetedIds, ["orbix/college_verifications/test_asset_1"], "Only the current attempt asset must be targeted");
        recordPass("8. No pre-existing or unrelated Cloudinary asset is deleted");
    } catch (err: any) {
        recordFail("8. No pre-existing or unrelated Cloudinary asset is deleted", err);
    }

    // --------------------------------------------------------------------------------------------------
    // TEST 9: A retry does not accidentally delete assets from a previous successful submission.
    // --------------------------------------------------------------------------------------------------
    try {
        // Attempt 1: Previous successful submission
        const { queryFn: queryAttempt1 } = createMockQuery({ insertFails: false });
        const { uploader: uploader1, uploadedAssetIds: attempt1Assets, destroyCalls: destroyAttempt1 } = createMockUploader();

        const res1 = await CollegeVerificationService.submitApplication(
            {
                userId,
                collegeId,
                documentType: "student_id",
                ...defaultContact,
                files: [{ buffer: validPngBuffer, originalname: "attempt1.png", mimetype: "image/png", size: validPngBuffer.length }],
            },
            {
                query: queryAttempt1,
                uploader: uploader1,
                isCloudinaryConfigured: () => true,
            }
        );
        assert.equal(res1.success, true);
        assert.deepEqual(attempt1Assets, ["orbix/college_verifications/test_asset_1"]);
        assert.equal(destroyAttempt1.length, 0, "No assets deleted on attempt 1");

        // Attempt 2: Student retries later, but upload fails on file 2
        const { queryFn: queryAttempt2 } = createMockQuery();
        const { uploader: uploader2, destroyCalls: destroyAttempt2 } = createMockUploader({
            failOnUploadIndex: 2,
            uploadErrorMessage: "Upload error on retry attempt 2",
        });

        await assert.rejects(async () => {
            await CollegeVerificationService.submitApplication(
                {
                    userId,
                    collegeId,
                    documentType: "student_id_both_sides",
                    ...defaultContact,
                    files: [
                        { buffer: validPngBuffer, originalname: "retry_front.png", mimetype: "image/png", size: validPngBuffer.length },
                        { buffer: validJpegBuffer, originalname: "retry_back.jpg", mimetype: "image/jpeg", size: validJpegBuffer.length },
                    ],
                },
                {
                    query: queryAttempt2,
                    uploader: uploader2,
                    isCloudinaryConfigured: () => true,
                }
            );
        });

        // Verify attempt 2 only destroyed its own new asset ('orbix/college_verifications/test_asset_1' on uploader2),
        // and never touched attempt 1's uploader or assets!
        assert.equal(destroyAttempt1.length, 0, "Attempt 1 assets must remain untouched after attempt 2 failure");
        assert.equal(destroyAttempt2.length, 1, "Attempt 2 only deleted its own asset");
        recordPass("9. A retry does not accidentally delete assets from a previous successful submission");
    } catch (err: any) {
        recordFail("9. A retry does not accidentally delete assets from a previous successful submission", err);
    }

    // --------------------------------------------------------------------------------------------------
    // TEST 10: Successful submission behavior and existing verification workflow remain unchanged.
    // --------------------------------------------------------------------------------------------------
    try {
        const { queryFn } = createMockQuery({ insertFails: false });
        const { uploader, destroyCalls, uploadedAssetIds } = createMockUploader();

        const result = await CollegeVerificationService.submitApplication(
            {
                userId,
                collegeId,
                documentType: "student_id_both_sides",
                files: [
                    { buffer: validPngBuffer, originalname: "student_front.png", mimetype: "image/png", size: validPngBuffer.length },
                    { buffer: validJpegBuffer, originalname: "student_back.jpg", mimetype: "image/jpeg", size: validJpegBuffer.length },
                ],
                extractedData: {
                    studentName: "Aarav Sharma",
                    collegeName: "Indian Institute of Technology Kanpur",
                    enrollmentNumber: "IITK/2024/CS/101",
                    courseName: "B.Tech Computer Science",
                    academicYear: "2024-2028",
                    institutionEmail: "aarav@iitk.ac.in",
                    phoneNumber: "+919876543210",
                },
                studentName: "Aarav Sharma",
                enrollmentNumber: "IITK/2024/CS/101",
                courseName: "B.Tech Computer Science",
                academicYear: "2024-2028",
                institutionEmail: "aarav@iitk.ac.in",
                phoneNumber: "9876543210",
                ocrConfidence: 94,
            },
            {
                query: queryFn,
                uploader,
                isCloudinaryConfigured: () => true,
            }
        );

        assert.equal(result.success, true);
        assert.equal(result.application.status, "PENDING");
        assert.equal(result.application.document_type, "student_id_both_sides");
        assert.equal(uploadedAssetIds.length, 2);
        assert.equal(destroyCalls.length, 0);

        recordPass("10. Successful submission behavior and existing verification workflow remain unchanged");
    } catch (err: any) {
        recordFail("10. Successful submission behavior and existing verification workflow remain unchanged", err);
    }

    // --------------------------------------------------------------------------------------------------
    // TEST 11: Staging folder isolation via CLOUDINARY_VERIFICATION_FOLDER environment variable.
    // --------------------------------------------------------------------------------------------------
    const prevFolderEnv = process.env.CLOUDINARY_VERIFICATION_FOLDER;
    try {
        process.env.CLOUDINARY_VERIFICATION_FOLDER = "orbix_staging/college_verifications";

        const { queryFn } = createMockQuery();
        const { uploader, deletedAssetIds, destroyCalls } = createMockUploader({
            failOnUploadIndex: 2,
            uploadErrorMessage: "Staging upload failure simulation on second file",
        });

        await assert.rejects(
            async () => {
                await CollegeVerificationService.submitApplication(
                    {
                        userId,
                        collegeId,
                        documentType: "student_id_both_sides",
                        ...defaultContact,
                        files: [
                            { buffer: validPngBuffer, originalname: "front.png", mimetype: "image/png", size: validPngBuffer.length },
                            { buffer: validJpegBuffer, originalname: "back.jpg", mimetype: "image/jpeg", size: validJpegBuffer.length },
                        ],
                    },
                    {
                        query: queryFn,
                        uploader,
                        isCloudinaryConfigured: () => true,
                    }
                );
            },
            /Staging upload failure simulation on second file/
        );

        const expectedDeletedId = "orbix_staging/college_verifications/test_asset_1";
        assert.equal(destroyCalls.length, 1, "Exactly one destroy call should be made in staging folder");
        assert.equal(destroyCalls[0]?.publicId, expectedDeletedId, "Staging prefix must be present in deleted asset publicId");
        assert.equal(destroyCalls[0]?.options?.type, "authenticated", "Authenticated mode must be specified for staging assets");
        assert.deepEqual(deletedAssetIds, [expectedDeletedId], "Deleted IDs must match exact staging asset ID");
        recordPass("11. Staging folder isolation: CLOUDINARY_VERIFICATION_FOLDER isolates assets and cleanup targeting");
    } catch (err: any) {
        recordFail("11. Staging folder isolation: CLOUDINARY_VERIFICATION_FOLDER isolates assets and cleanup targeting", err);
    } finally {
        if (prevFolderEnv !== undefined) {
            process.env.CLOUDINARY_VERIFICATION_FOLDER = prevFolderEnv;
        } else {
            delete process.env.CLOUDINARY_VERIFICATION_FOLDER;
        }
    }

    try {
        if (redis && typeof redis.disconnect === "function") {
            redis.disconnect();
        }
    } catch {}

    console.log("\n=================================================");
    console.log(`SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log("=================================================\n");

    if (failedTests > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runRegressionTests().catch((err) => {
    console.error("Test execution aborted:", err);
    process.exit(1);
});
