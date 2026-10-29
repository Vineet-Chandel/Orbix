import { query } from "../../database/client.js";

/**
 * Enriches a user object with their verified club or pending club application details.
 * This attaches `verifiedClub`, `clubStatus`, `clubName`, `clubId`, and `application`
 * so any user account (personal or club) has complete visibility into the clubs they lead.
 */
export async function enrichUserWithClubData(userObj: any, userId: string) {
    if (!userId || !userObj) return userObj;
    try {
        const verifiedClubRes = await query(
            `SELECT vc.id, vc.name, COALESCE(u.username, vc.slug) AS slug, u.username AS "clubUsername", vc.category, vc.college_name, vc.logo_url, vc.is_active 
             FROM verified_clubs vc 
             LEFT JOIN users u ON u.id = vc.auth_user_id 
             WHERE vc.auth_user_id = $1 LIMIT 1;`,
            [userId]
        );
        const verifiedClub = verifiedClubRes.rows[0];

        const reqRes = await query(
            `SELECT id, status, club_name, college_name, submitted_at, contact_email, contact_phone
             FROM club_verification_requests 
             WHERE auth_user_id = $1 
             ORDER BY submitted_at DESC 
             LIMIT 1;`,
            [userId]
        );
        const application = reqRes.rows[0];

        if (verifiedClub) {
            userObj.verifiedClub = {
                id: verifiedClub.id,
                name: verifiedClub.name,
                slug: verifiedClub.slug,
                category: verifiedClub.category,
                collegeName: verifiedClub.college_name,
                logoUrl: verifiedClub.logo_url,
                isActive: verifiedClub.is_active,
            };
            userObj.clubStatus = "approved";
            userObj.clubName = verifiedClub.name;
            userObj.clubId = verifiedClub.id;
        } else if (application) {
            userObj.verifiedClub = null;
            userObj.clubStatus = application.status;
            userObj.clubName = application.club_name;
            userObj.clubId = application.id;
            userObj.application = {
                id: application.id,
                status: application.status,
                clubName: application.club_name,
                collegeName: application.college_name,
                submittedAt: application.submitted_at,
            };
        } else {
            userObj.verifiedClub = null;
            userObj.clubStatus = "none";
            userObj.clubName = null;
            userObj.clubId = null;
            userObj.application = null;
        }
    } catch (clubErr) {
        console.warn("Notice: club data enrichment warning:", clubErr);
    }
    return userObj;
}
