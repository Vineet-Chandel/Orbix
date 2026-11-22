// Existing demo aliases are synthetic fixtures, never search-indexed organizations.
export function isDemoClubSlug(slug?: string | null): boolean {
    if (!slug) return false;
    const clean = slug.trim().toLowerCase();
    if (
        clean === "aws-swg-psit" ||
        clean === "aws-psit" ||
        clean === "aws-swg" ||
        clean === "acm-psit" ||
        clean === "demo" ||
        clean === "demo-club" ||
        clean === "demo/club" ||
        clean === "acm" ||
        clean === "acm-student-chapter" ||
        clean === "aws" ||
        clean === "aws-student-work-group" ||
        clean === "aws-student-working-group"
    ) return true;
    const collapsed = clean.replace(/[-_.\s]/g, "");
    return (
        collapsed === "awsswgpsit" ||
        collapsed === "awspsit" ||
        collapsed === "awsswg" ||
        collapsed === "acmpsit" ||
        collapsed === "democlub" ||
        collapsed === "acmstudentchapter" ||
        collapsed === "psitacm" ||
        collapsed === "psitaws" ||
        collapsed === "psitawsswg"
    );
}
