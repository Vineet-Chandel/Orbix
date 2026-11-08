/**
 * Certificate Studio Frontend Types
 */

export type CertificateOrientation = "landscape" | "portrait";
export type CertificateCategory =
    | "all"
    | "event"
    | "workshop"
    | "hackathon"
    | "achievement"
    | "merit"
    | "appreciation"
    | "academic"
    | "custom";

export interface BlankPreset {
    id: string;
    name: string;
    orientation: CertificateOrientation;
    width: number;
    height: number;
    backgroundColor?: string;
}

export type CertificateElementType =
    | "static-text"
    | "text"
    | "dynamic-text"
    | "dynamic_text"
    | "image"
    | "shape"
    | "qr-code"
    | "qr_code"
    | "signature"
    | "badge";

export interface CertificateElementStyle {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: "normal" | "bold" | "black" | "300" | "400" | "600" | "700" | "900" | string;
    color?: string;
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
    textAlign?: "left" | "center" | "right";
    letterSpacing?: number;
    lineHeight?: number;
    opacity?: number;
    textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
}

export interface CertificateElement {
    id: string;
    type: CertificateElementType;
    x: number; // in pt (0 - 842 for A4 landscape)
    y: number; // in pt (0 - 595 for A4 landscape)
    width: number;
    height: number;
    rotation?: number;
    zIndex: number;
    style?: CertificateElementStyle;
    fieldKey?: string;
    text?: string;
    content?: string;
    imageUrl?: string;
    fallbackValue?: string;
    fitPolicy?: "shrink" | "wrap" | "warn";
    isLocked?: boolean;
    isHidden?: boolean;

    // Direct / flat styling properties for shapes and text
    shapeType?: "rectangle" | "circle" | "line" | "star" | string;
    strokeColor?: string;
    strokeWidth?: number;
    fillColor?: string;
    cornerRadius?: number;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string;
    color?: string;
    textAlign?: "left" | "center" | "right";
    letterSpacing?: number;
    lineHeight?: number;
    qrDataKey?: string;
    signerName?: string;
    signerTitle?: string;
    signatureUrl?: string;
    imageFit?: "contain" | "cover";
    iconName?: string;
    isRequired?: boolean;
    minFontSize?: number;
    maxFontSize?: number;
    maxLines?: number;
    dataType?: "text" | "number" | "date" | "url";
}

export interface CustomAttributeDefinition {
    key: string;
    label: string;
    dataType: "text" | "number" | "date" | "url";
    isRequired?: boolean;
    scope: "all" | "individual" | "team";
    sampleValue: string;
    description?: string;
}

export interface CertificateDesign {
    style?: string;
    subcategory?: string;
    aspectRatio?: string;
    version?: string;
    customAttributes?: CustomAttributeDefinition[];
    page?: {
        width: number;
        height: number;
        orientation: CertificateOrientation;
        unit: "pt" | "px";
    };
    dimensions?: {
        width: number;
        height: number;
        orientation: CertificateOrientation;
        unit?: "pt" | "px" | string;
    };
    background: {
        type: "color" | "gradient" | "image" | "preset";
        color?: string;
        gradient?: string;
        imageUrl?: string;
        assetUrl?: string;
        fit?: "cover" | "contain" | "stretch";
        borderStyle?: "double" | "solid" | "ornate" | "modern" | "neo-brutalist" | "none";
        borderColor?: string;
        borderWidth?: number;
        accentColor?: string;
    };
    elements: CertificateElement[];
}

export interface CertificateTemplateRecord {
    id: string;
    clubId: string | null;
    ownerClubName?: string;
    creatorName?: string;
    usageCount?: number;
    pageSizeLabel?: string;
    isSystem: boolean;
    is_system?: boolean;
    name: string;
    category: string;
    subcategory?: string;
    style?: string;
    aspectRatio?: string;
    description?: string;
    design: CertificateDesign;
    backgroundAssetUrl?: string | null;
    backgroundFit: "cover" | "contain" | "stretch";
    orientation: CertificateOrientation;
    pageWidth: number;
    pageHeight: number;
    version: number;
    status: "draft" | "published" | "archived";
    thumbnailUrl?: string | null;
    createdBy?: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface CertificateBatchRecord {
    id: string;
    clubId: string;
    eventId?: string | null;
    eventTitle?: string | null;
    templateId?: string | null;
    templateName?: string | null;
    templateVersion: number;
    title: string;
    certificateType: string;
    issuanceSource: "event" | "team" | "manual" | "csv";
    issuance_source?: string;
    totalRecipients: number;
    successfulCount: number;
    successful_count?: number;
    failedCount: number;
    status: "draft" | "validating" | "queued" | "processing" | "completed" | "partially_completed" | "partially_failed" | "failed" | "cancelled";
    createdAt: string;
    updatedAt: string;
}

export interface BatchProgressInfo {
    id: string;
    clubId: string;
    title: string;
    status: "queued" | "processing" | "completed" | "partially_completed" | "partially_failed" | "failed";
    totalRecipients: number;
    processedCount: number;
    successfulCount: number;
    failedCount: number;
    progressPercentage: number;
    currentThroughput: number;
    errorLog: Array<{
        recipientName?: string;
        email?: string;
        error: string;
        timestamp: string;
    }>;
    isRecoverable: boolean;
    canRetry: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface ReconciledCsvRow {
    index: number;
    name: string;
    email: string;
    role?: string;
    position?: string;
    team?: string;
    notes?: string;
    status: "matched_student" | "external_recipient" | "invalid";
    matchedUser?: {
        id: string;
        name: string;
        username: string;
        email: string;
        collegeName?: string;
        eventAttendance?: "attended" | "registered" | "none";
        checkedInAt?: string | null;
    };
    validationErrors?: string[];
}

export interface CsvReconciliationResult {
    totalRows: number;
    matchedStudentsCount: number;
    externalCount: number;
    invalidCount: number;
    duplicateCount: number;
    detectedColumns: Record<string, string>;
    rows: ReconciledCsvRow[];
}

export interface DynamicDataSnapshot {
    recipient: {
        id: string;
        name: string;
        fullName?: string | undefined;
        firstName?: string | undefined;
        middleName?: string | undefined;
        lastName?: string | undefined;
        username: string;
        email?: string | undefined;
        headline?: string | undefined;
        collegeName?: string | undefined;
        institution?: string | undefined;
        university?: string | undefined;
        campus?: string | undefined;
        avatarUrl?: string | undefined;
        department?: string | undefined;
        yearOfStudy?: string | undefined;
        rollNumber?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
    };
    event?: {
        id?: string | undefined;
        title?: string | undefined;
        name?: string | undefined;
        category?: string | undefined;
        date?: string | undefined;
        venue?: string | undefined;
        location?: string | undefined;
        organizingClub?: string | undefined;
    } | undefined;
    club: {
        id: string;
        name: string;
        slug: string;
        collegeName?: string | undefined;
        logoUrl?: string | undefined;
        leadName?: string | undefined;
    };
    award: {
        title: string;
        type: string;
        description: string;
        position?: string | undefined;
        rank?: string | undefined;
        awardCategory?: string | undefined;
        participationStatus?: string | undefined;
        completionStatus?: string | undefined;
    };
    team?: {
        id?: string | undefined;
        name?: string | undefined;
        role?: string | undefined;
        identifier?: string | undefined;
        members?: string | undefined;
        position?: string | undefined;
        achievement?: string | undefined;
        memberCount?: number | undefined;
        memberSnapshot?: Array<{
            userId?: string | null | undefined;
            isExternal?: boolean | undefined;
            name: string;
            username?: string | undefined;
            email?: string | undefined;
            role?: string | undefined;
            customPosition?: string | undefined;
        }> | undefined;
    } | undefined;
    certificate: {
        credentialCode: string;
        number?: string | undefined;
        issueDate: string;
        verificationUrl: string;
        signerName: string;
        signerRole: string;
        issuingAuthority?: string | undefined;
    };
    custom?: Record<string, any> | undefined;
}

export interface DynamicFieldDefinition {
    key: string;
    label: string;
    category: "recipient" | "event" | "achievement" | "team" | "issuance" | "club" | "custom";
    description: string;
    sampleValue: string;
    dataType?: "text" | "number" | "date" | "url";
    iconName?: string;
    isCustom?: boolean;
}

export const AVAILABLE_DYNAMIC_FIELDS: DynamicFieldDefinition[] = [
    // Recipient Fields
    { key: "recipient.name", label: "Recipient Full Name", category: "recipient", description: "Full verified name of the student", sampleValue: "Aarav Sharma", dataType: "text" },
    { key: "recipient.firstName", label: "Recipient First Name", category: "recipient", description: "First name only", sampleValue: "Aarav", dataType: "text" },
    { key: "recipient.middleName", label: "Recipient Middle Name", category: "recipient", description: "Middle name if available", sampleValue: "Kumar", dataType: "text" },
    { key: "recipient.lastName", label: "Recipient Last Name", category: "recipient", description: "Surname / family name", sampleValue: "Sharma", dataType: "text" },
    { key: "recipient.username", label: "Orbix Username", category: "recipient", description: "@handle on Orbix platform", sampleValue: "aarav_dev", dataType: "text" },
    { key: "recipient.headline", label: "Profile Headline", category: "recipient", description: "Developer headline & bio summary", sampleValue: "Full-Stack Developer & Open Source Contributor", dataType: "text" },
    { key: "recipient.institution", label: "Institution / University", category: "recipient", description: "Host or affiliated educational institution", sampleValue: "Delhi Technological University", dataType: "text" },
    { key: "recipient.campus", label: "Campus Location", category: "recipient", description: "Specific campus branch or center", sampleValue: "Main Campus (Shahbad Daulatpur)", dataType: "text" },
    { key: "recipient.department", label: "Academic Department", category: "recipient", description: "Engineering branch or school", sampleValue: "Computer Science & Engineering", dataType: "text" },
    { key: "recipient.rollNumber", label: "Roll / Enrollment Number", category: "recipient", description: "Unique campus student identification code", sampleValue: "2K22/CO/142", dataType: "text" },
    { key: "recipient.city", label: "Recipient City", category: "recipient", description: "City of residence or campus", sampleValue: "New Delhi", dataType: "text" },
    { key: "recipient.state", label: "Recipient State", category: "recipient", description: "State or province", sampleValue: "Delhi", dataType: "text" },
    
    // Event Fields
    { key: "event.title", label: "Event Name", category: "event", description: "Official title of the event or hackathon", sampleValue: "Annual HackSphere 2026", dataType: "text" },
    { key: "event.category", label: "Event Category", category: "event", description: "Type of event (Hackathon, Workshop, Bootcamp)", sampleValue: "Hackathon & Design Sprint", dataType: "text" },
    { key: "event.date", label: "Event Date", category: "event", description: "Date when the event was conducted", sampleValue: "November 8, 2026", dataType: "date" },
    { key: "event.venue", label: "Event Venue / Hall", category: "event", description: "Campus room, auditorium, or virtual portal", sampleValue: "Pragyan Auditorium, Hall B", dataType: "text" },
    { key: "event.location", label: "Event City / Location", category: "event", description: "Geographic location of event", sampleValue: "New Delhi, India", dataType: "text" },
    { key: "event.organizingClub", label: "Organizing Chapter", category: "event", description: "Lead organizing club or chapter", sampleValue: "Orbix Developer Society", dataType: "text" },
    
    // Club Fields
    { key: "club.name", label: "Club Name", category: "club", description: "Full verified student organization name", sampleValue: "Orbix Developer Society", dataType: "text" },
    { key: "club.collegeName", label: "Club University", category: "club", description: "Host university / institute", sampleValue: "Delhi Technological University", dataType: "text" },
    { key: "club.leadName", label: "Club President / Lead", category: "club", description: "Presiding student or faculty leader", sampleValue: "Ananya Roy", dataType: "text" },
    
    // Achievement & Award Fields
    { key: "award.title", label: "Certificate Title", category: "achievement", description: "Name of the credential or honor", sampleValue: "Certificate of Achievement", dataType: "text" },
    { key: "award.description", label: "Achievement Citation", category: "achievement", description: "Formal citation explaining accomplishment", sampleValue: "In recognition of outstanding algorithmic problem solving, exceptional teamwork, and demonstrated commitment to technical excellence.", dataType: "text" },
    { key: "award.position", label: "Award Position / Placement", category: "achievement", description: "Rank or winning position", sampleValue: "Winner — 1st Place", dataType: "text" },
    { key: "award.rank", label: "Placement Rank", category: "achievement", description: "Numeric or short ordinal ranking", sampleValue: "Rank #1", dataType: "text" },
    { key: "award.awardCategory", label: "Award Category", category: "achievement", description: "Specific competition award track", sampleValue: "Best AI Innovation", dataType: "text" },
    { key: "award.participationStatus", label: "Participation Status", category: "achievement", description: "Status code of participation", sampleValue: "Verified Attendee", dataType: "text" },
    { key: "award.completionStatus", label: "Completion Status", category: "achievement", description: "Graduation or passing status", sampleValue: "Distinction Honors", dataType: "text" },
    
    // Team Fields
    { key: "team.name", label: "Team Name", category: "team", description: "Name of the hackathon or project team", sampleValue: "Team NeuralForge", dataType: "text" },
    { key: "team.identifier", label: "Team Identifier", category: "team", description: "Unique team registration code", sampleValue: "TEAM-NF-09", dataType: "text" },
    { key: "team.role", label: "Member Team Role", category: "team", description: "Designated role in team", sampleValue: "Lead ML Architect", dataType: "text" },
    { key: "team.members", label: "Team Members List", category: "team", description: "Comma-separated team roster", sampleValue: "Aarav Sharma, Rhea Patel, Rohan Gupta", dataType: "text" },
    { key: "team.position", label: "Team Placement", category: "team", description: "Team final standing", sampleValue: "Winning Team (1st Place)", dataType: "text" },
    { key: "team.achievement", label: "Team Achievement", category: "team", description: "Special recognition earned by team", sampleValue: "Best Full-Stack System Architecture", dataType: "text" },
    
    // Issuance & Security Fields
    { key: "certificate.credentialCode", label: "Credential ID / Code", category: "issuance", description: "Unique cryptographically verifiable code", sampleValue: "ORB-SOC-2026-F9A3B2", dataType: "text" },
    { key: "certificate.number", label: "Certificate Serial Number", category: "issuance", description: "Sequential registry issue index", sampleValue: "ORB-2026-0042", dataType: "text" },
    { key: "certificate.issueDate", label: "Date of Issuance", category: "issuance", description: "Conferral date", sampleValue: "November 8, 2026", dataType: "date" },
    { key: "certificate.verificationUrl", label: "Verification URL", category: "issuance", description: "Public trust validation registry link", sampleValue: "https://orbix.dev/verify/certificate/ORB-SOC-2026-F9A3B2", dataType: "url" },
    { key: "certificate.issuingAuthority", label: "Issuing Authority", category: "issuance", description: "Accrediting body / council", sampleValue: "Orbix Credential Council & Chapter Senate", dataType: "text" },
    { key: "certificate.signerName", label: "Authorized Signatory", category: "issuance", description: "Name of club lead or faculty coordinator", sampleValue: "Prof. Rajesh Verma", dataType: "text" },
    { key: "certificate.signerRole", label: "Signatory Title", category: "issuance", description: "Official designation of signer", sampleValue: "Faculty Advisor & Head of Dept", dataType: "text" },
];
