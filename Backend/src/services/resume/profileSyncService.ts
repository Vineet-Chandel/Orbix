import { query } from "../../database/client.js";
import type {
    StructuredResumeFacts,
    ProfileSyncProposal,
    ProposedSyncField
} from "./resumeTypes.js";

export interface UserProfileRow {
    id: string;
    username: string;
    headline: string | null;
    bio: string | null;
    location: string | null;
    website: string | null;
    github: string | null;
    linkedin: string | null;
    skills: string[] | null;
    college: string | null;
    college_id?: string | null;
    collegeId?: string | null;
    links?: Array<{ label: string; url: string; platform?: string }> | string | null;
}

export class ProfileSyncService {
    /**
     * Builds a proposal for syncing extracted resume data into the user profile.
     * Strictly limits proposals to fields that are currently empty / missing in the profile.
     */
    public buildSyncProposal(currentProfile: Partial<UserProfileRow>, facts: StructuredResumeFacts): ProfileSyncProposal {
        const proposedFields: ProposedSyncField[] = [];

        // Parse existing links array to avoid proposing duplicates
        let existingLinks: Array<{ label?: string; url?: string; platform?: string }> = [];
        if (Array.isArray(currentProfile.links)) {
            existingLinks = currentProfile.links;
        } else if (typeof currentProfile.links === "string") {
            try {
                existingLinks = JSON.parse(currentProfile.links);
            } catch {
                existingLinks = [];
            }
        }

        const hasGithub = Boolean(
            (currentProfile.github && currentProfile.github.trim() !== "") ||
            existingLinks.some(l => (l.platform && l.platform.toLowerCase() === "github") || (l.url && l.url.toLowerCase().includes("github.com")))
        );

        const hasLinkedin = Boolean(
            (currentProfile.linkedin && currentProfile.linkedin.trim() !== "") ||
            existingLinks.some(l => (l.platform && l.platform.toLowerCase() === "linkedin") || (l.url && l.url.toLowerCase().includes("linkedin.com")))
        );

        const hasWebsite = Boolean(
            (currentProfile.website && currentProfile.website.trim() !== "") ||
            existingLinks.some(l =>
                (l.platform && ["portfolio", "website", "personal"].includes(l.platform.toLowerCase())) ||
                (l.label && ["portfolio", "website", "personal"].includes(l.label.toLowerCase()))
            )
        );

        const hasCollege = Boolean(
            (currentProfile.college && currentProfile.college.trim() !== "") ||
            currentProfile.college_id ||
            currentProfile.collegeId
        );

        // 1. Headline
        const extractedHeadline = facts.personal.headline?.value;
        const isHeadlineMissing = !currentProfile.headline || currentProfile.headline.trim() === "";
        if (extractedHeadline && extractedHeadline.trim().length > 0) {
            proposedFields.push({
                fieldKey: "headline",
                label: "Professional Headline",
                currentProfileValue: currentProfile.headline || null,
                proposedValue: extractedHeadline.trim(),
                isMissingInProfile: isHeadlineMissing,
                confidence: Math.round((facts.personal.headline?.extractionConfidence || 0.85) * 100),
                sourceExcerpt: facts.personal.headline?.sourceText || extractedHeadline
            });
        }

        // 2. Location
        const extractedLocation = facts.personal.location?.value;
        const isLocationMissing = !currentProfile.location || currentProfile.location.trim() === "";
        if (extractedLocation && extractedLocation.trim().length > 0) {
            proposedFields.push({
                fieldKey: "location",
                label: "Location",
                currentProfileValue: currentProfile.location || null,
                proposedValue: extractedLocation.trim(),
                isMissingInProfile: isLocationMissing,
                confidence: Math.round((facts.personal.location?.extractionConfidence || 0.90) * 100),
                sourceExcerpt: facts.personal.location?.sourceText || extractedLocation
            });
        }

        // 3. GitHub Link
        const githubLink = facts.personal.links.find(l => l.platform.toLowerCase() === "github")?.url;
        if (githubLink) {
            proposedFields.push({
                fieldKey: "github",
                label: "GitHub Profile",
                currentProfileValue: currentProfile.github || null,
                proposedValue: githubLink.trim(),
                isMissingInProfile: !hasGithub,
                confidence: 95,
                sourceExcerpt: githubLink
            });
        }

        // 4. LinkedIn Link
        const linkedinLink = facts.personal.links.find(l => l.platform.toLowerCase() === "linkedin")?.url;
        if (linkedinLink) {
            proposedFields.push({
                fieldKey: "linkedin",
                label: "LinkedIn Profile",
                currentProfileValue: currentProfile.linkedin || null,
                proposedValue: linkedinLink.trim(),
                isMissingInProfile: !hasLinkedin,
                confidence: 95,
                sourceExcerpt: linkedinLink
            });
        }

        // 5. Portfolio / Website Link
        const portfolioLink = facts.personal.links.find(l =>
            ["portfolio", "website"].includes(l.platform.toLowerCase())
        )?.url;
        if (portfolioLink) {
            proposedFields.push({
                fieldKey: "website",
                label: "Personal Website / Portfolio",
                currentProfileValue: currentProfile.website || null,
                proposedValue: portfolioLink.trim(),
                isMissingInProfile: !hasWebsite,
                confidence: 90,
                sourceExcerpt: portfolioLink
            });
        }

        // 6. College / Institution
        const topCollege = facts.education[0]?.institution?.value;
        if (topCollege && topCollege.trim().length > 0) {
            proposedFields.push({
                fieldKey: "college",
                label: "College / University",
                currentProfileValue: currentProfile.college || null,
                proposedValue: topCollege.trim(),
                isMissingInProfile: !hasCollege,
                confidence: Math.round((facts.education[0]?.institution?.extractionConfidence || 0.90) * 100),
                sourceExcerpt: facts.education[0]?.sourceText || topCollege
            });
        }

        // 7. Skills List
        const extractedSkills = Array.from(new Set([
            ...facts.competencies.languages.map(l => l.value),
            ...facts.competencies.frameworks.map(f => f.value),
            ...facts.competencies.databasesAndStores.map(d => d.value),
            ...facts.competencies.toolsAndCloud.map(t => t.value)
        ])).filter(s => s && s.length > 1);

        const currentSkills = Array.isArray(currentProfile.skills) ? currentProfile.skills : [];
        const isSkillsMissing = currentSkills.length === 0;

        if (extractedSkills.length > 0) {
            // Propose newly discovered skills
            const newSkillsToAdd = extractedSkills.filter(s => !currentSkills.some(cs => cs.toLowerCase() === s.toLowerCase()));
            const proposedSkills = isSkillsMissing ? extractedSkills.slice(0, 15) : [...currentSkills, ...newSkillsToAdd.slice(0, 10)];

            if (isSkillsMissing || newSkillsToAdd.length > 0) {
                proposedFields.push({
                    fieldKey: "skills",
                    label: "Technical Skills",
                    currentProfileValue: currentSkills,
                    proposedValue: proposedSkills,
                    isMissingInProfile: isSkillsMissing || newSkillsToAdd.length > 0,
                    confidence: 90,
                    sourceExcerpt: `${extractedSkills.slice(0, 8).join(", ")}...`
                });
            }
        }

        // Only include fields that are actually missing in the profile
        const eligibleFields = proposedFields.filter(f => f.isMissingInProfile);

        return {
            proposedFields: eligibleFields,
            totalEligibleFields: eligibleFields.length,
            hasMissingFields: eligibleFields.length > 0
        };
    }

    /**
     * Applies the user-approved sync fields to the user profile in Postgres.
     */
    public async applyProfileSync(
        userIdOrUsername: string,
        approvedFieldKeys: string[],
        proposal: ProfileSyncProposal
    ): Promise<{ updatedFields: string[]; success: boolean; user?: any }> {
        if (!approvedFieldKeys || approvedFieldKeys.length === 0) {
            return { updatedFields: [], success: true };
        }

        // Filter approved fields that are part of the proposal
        const fieldsToApply = proposal.proposedFields.filter(
            f => approvedFieldKeys.includes(f.fieldKey) && f.isMissingInProfile
        );

        if (fieldsToApply.length === 0) {
            return { updatedFields: [], success: true };
        }

        // Fetch current user row so we have existing links, college_id, etc.
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userIdOrUsername);
        const currentUserRes = await query(
            `SELECT id, username, links, college, college_id, college_updated_at FROM users WHERE ${isUuid ? "id = $1::uuid" : "(id::text = $1 OR username = $1)"} LIMIT 1;`,
            [userIdOrUsername]
        );
        const currentUserRow = currentUserRes.rows[0] || {};

        let currentLinks: Array<{ label: string; url: string; platform?: string }> = [];
        if (Array.isArray(currentUserRow.links)) {
            currentLinks = currentUserRow.links;
        } else if (typeof currentUserRow.links === "string") {
            try {
                currentLinks = JSON.parse(currentUserRow.links);
            } catch {
                currentLinks = [];
            }
        }

        const updateParts: string[] = [];
        const values: any[] = [];
        let paramIdx = 1;
        let shouldUpdateLinks = false;
        const newLinks = [...currentLinks];

        for (const field of fieldsToApply) {
            if (field.fieldKey === "headline") {
                updateParts.push(`headline = $${paramIdx++}`);
                values.push(field.proposedValue);
            } else if (field.fieldKey === "location") {
                updateParts.push(`location = $${paramIdx++}`);
                values.push(field.proposedValue);
            } else if (field.fieldKey === "github") {
                updateParts.push(`github = $${paramIdx++}`);
                values.push(field.proposedValue);
                if (!newLinks.some(l => (l.platform && l.platform.toLowerCase() === "github") || (l.url && l.url.includes("github.com")))) {
                    if (newLinks.length < 4) {
                        newLinks.push({ label: "GitHub", url: String(field.proposedValue), platform: "github" });
                        shouldUpdateLinks = true;
                    }
                }
            } else if (field.fieldKey === "linkedin") {
                updateParts.push(`linkedin = $${paramIdx++}`);
                values.push(field.proposedValue);
                if (!newLinks.some(l => (l.platform && l.platform.toLowerCase() === "linkedin") || (l.url && l.url.includes("linkedin.com")))) {
                    if (newLinks.length < 4) {
                        newLinks.push({ label: "LinkedIn", url: String(field.proposedValue), platform: "linkedin" });
                        shouldUpdateLinks = true;
                    }
                }
            } else if (field.fieldKey === "website") {
                updateParts.push(`website = $${paramIdx++}`);
                values.push(field.proposedValue);
                if (!newLinks.some(l => (l.platform && ["portfolio", "website", "personal"].includes(l.platform.toLowerCase())))) {
                    if (newLinks.length < 4) {
                        newLinks.push({ label: "Portfolio", url: String(field.proposedValue), platform: "portfolio" });
                        shouldUpdateLinks = true;
                    }
                }
            } else if (field.fieldKey === "college") {
                // If user college affiliation is locked under the 3-day cooldown rule, do not overwrite it
                const isCollegeLocked =
                    currentUserRow.college_updated_at &&
                    Date.now() - new Date(currentUserRow.college_updated_at).getTime() < 3 * 24 * 60 * 60 * 1000;

                if (isCollegeLocked) {
                    continue; // Skip locked college update
                }

                const collegeName = String(field.proposedValue).trim();
                let matchedCollegeId: string | null = null;
                let officialName = collegeName;
                try {
                    const instCheck = await query(
                        `SELECT id, official_name FROM institutions
                         WHERE official_name ILIKE $1
                            OR $2 ILIKE ('%' || official_name || '%')
                            OR (name_variants IS NOT NULL AND name_variants ILIKE ('%' || $1 || '%'))
                         ORDER BY verification_status = 'verified' DESC
                         LIMIT 1;`,
                        [collegeName, collegeName]
                    );
                    if (instCheck.rows[0]) {
                        matchedCollegeId = instCheck.rows[0].id;
                        officialName = instCheck.rows[0].official_name || collegeName;
                    }
                } catch {
                    // Ignore institution lookup error
                }

                updateParts.push(`college = $${paramIdx++}`);
                values.push(officialName);

                if (matchedCollegeId && !currentUserRow.college_id) {
                    updateParts.push(`college_id = $${paramIdx++}`);
                    values.push(matchedCollegeId);
                }

                updateParts.push(`college_updated_at = CURRENT_TIMESTAMP`);
            } else if (field.fieldKey === "skills") {
                updateParts.push(`skills = $${paramIdx++}::jsonb`);
                values.push(JSON.stringify(field.proposedValue));
            }
        }

        if (shouldUpdateLinks) {
            updateParts.push(`links = $${paramIdx++}::jsonb`);
            values.push(JSON.stringify(newLinks.slice(0, 4)));
        }

        if (updateParts.length === 0) {
            return { updatedFields: [], success: true };
        }

        updateParts.push(`updated_at = CURRENT_TIMESTAMP`);

        const whereClause = isUuid ? `id = $${paramIdx}::uuid` : `(id::text = $${paramIdx} OR username = $${paramIdx})`;
        values.push(userIdOrUsername);

        const sql = `
            UPDATE users
            SET ${updateParts.join(", ")}
            WHERE ${whereClause}
            RETURNING
                id,
                username,
                firstname AS "firstName",
                middlename AS "middleName",
                lastname AS "lastName",
                email AS gmail,
                headline,
                bio,
                avatar_url AS "avatarUrl",
                photo_url AS "photoUrl",
                cover_image_url AS "coverImageUrl",
                website,
                linkedin,
                github,
                custom_link AS "customLink",
                location,
                skills,
                links,
                is_open_to_work AS "isOpenToWork",
                is_hireable AS "isHireable",
                is_public AS "isPublic",
                is_resume_public AS "isResumePublic",
                college,
                college_id AS "collegeId";
        `;

        const updateRes = await query(sql, values);

        return {
            updatedFields: fieldsToApply.map(f => f.fieldKey),
            success: true,
            user: updateRes.rows[0] || null
        };
    }
}
