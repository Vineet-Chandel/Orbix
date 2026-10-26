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
}

export class ProfileSyncService {
    /**
     * Builds a proposal for syncing extracted resume data into the user profile.
     * Strictly limits proposals to fields that are currently empty / missing in the profile.
     */
    public buildSyncProposal(currentProfile: Partial<UserProfileRow>, facts: StructuredResumeFacts): ProfileSyncProposal {
        const proposedFields: ProposedSyncField[] = [];

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
        const isGithubMissing = !currentProfile.github || currentProfile.github.trim() === "";
        if (githubLink) {
            proposedFields.push({
                fieldKey: "github",
                label: "GitHub Profile",
                currentProfileValue: currentProfile.github || null,
                proposedValue: githubLink.trim(),
                isMissingInProfile: isGithubMissing,
                confidence: 95,
                sourceExcerpt: githubLink
            });
        }

        // 4. LinkedIn Link
        const linkedinLink = facts.personal.links.find(l => l.platform.toLowerCase() === "linkedin")?.url;
        const isLinkedinMissing = !currentProfile.linkedin || currentProfile.linkedin.trim() === "";
        if (linkedinLink) {
            proposedFields.push({
                fieldKey: "linkedin",
                label: "LinkedIn Profile",
                currentProfileValue: currentProfile.linkedin || null,
                proposedValue: linkedinLink.trim(),
                isMissingInProfile: isLinkedinMissing,
                confidence: 95,
                sourceExcerpt: linkedinLink
            });
        }

        // 5. Portfolio / Website Link
        const portfolioLink = facts.personal.links.find(l =>
            ["portfolio", "website"].includes(l.platform.toLowerCase())
        )?.url;
        const isWebsiteMissing = !currentProfile.website || currentProfile.website.trim() === "";
        if (portfolioLink) {
            proposedFields.push({
                fieldKey: "website",
                label: "Personal Website / Portfolio",
                currentProfileValue: currentProfile.website || null,
                proposedValue: portfolioLink.trim(),
                isMissingInProfile: isWebsiteMissing,
                confidence: 90,
                sourceExcerpt: portfolioLink
            });
        }

        // 6. College / Institution
        const topCollege = facts.education[0]?.institution?.value;
        const isCollegeMissing = !currentProfile.college || currentProfile.college.trim() === "";
        if (topCollege && topCollege.trim().length > 0) {
            proposedFields.push({
                fieldKey: "college",
                label: "College / University",
                currentProfileValue: currentProfile.college || null,
                proposedValue: topCollege.trim(),
                isMissingInProfile: isCollegeMissing,
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
            // If user already has some skills, propose union of new ones
            const newSkillsToAdd = extractedSkills.filter(s => !currentSkills.some(cs => cs.toLowerCase() === s.toLowerCase()));
            const proposedSkills = isSkillsMissing ? extractedSkills.slice(0, 15) : [...currentSkills, ...newSkillsToAdd.slice(0, 10)];

            if (isSkillsMissing || newSkillsToAdd.length > 0) {
                proposedFields.push({
                    fieldKey: "skills",
                    label: "Technical Skills",
                    currentProfileValue: currentSkills,
                    proposedValue: proposedSkills,
                    isMissingInProfile: isSkillsMissing,
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
    ): Promise<{ updatedFields: string[]; success: boolean }> {
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

        const updateParts: string[] = [];
        const values: any[] = [];
        let paramIdx = 1;

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
            } else if (field.fieldKey === "linkedin") {
                updateParts.push(`linkedin = $${paramIdx++}`);
                values.push(field.proposedValue);
            } else if (field.fieldKey === "website") {
                updateParts.push(`website = $${paramIdx++}`);
                values.push(field.proposedValue);
            } else if (field.fieldKey === "college") {
                updateParts.push(`college = $${paramIdx++}`);
                values.push(field.proposedValue);
            } else if (field.fieldKey === "skills") {
                updateParts.push(`skills = $${paramIdx++}::jsonb`);
                values.push(JSON.stringify(field.proposedValue));
            }
        }

        if (updateParts.length === 0) {
            return { updatedFields: [], success: true };
        }

        updateParts.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(userIdOrUsername);

        const sql = `
            UPDATE users
            SET ${updateParts.join(", ")}
            WHERE id = $${paramIdx} OR username = $${paramIdx};
        `;

        await query(sql, values);

        return {
            updatedFields: fieldsToApply.map(f => f.fieldKey),
            success: true
        };
    }
}
