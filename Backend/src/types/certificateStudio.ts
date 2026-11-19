/**
 * Certificate Studio Shared Architecture Types
 */

export type CertificateOrientation = "landscape" | "portrait";
export type CertificateElementType =
    | "static-text"
    | "dynamic-text"
    | "image"
    | "shape"
    | "qr-code"
    | "signature"
    | "badge";

export interface CertificateElementStyle {
    fontFamily?: string | undefined;
    fontSize?: number | undefined;
    fontWeight?: "normal" | "bold" | "black" | "300" | "400" | "600" | "700" | "900" | string | undefined;
    color?: string | undefined;
    backgroundColor?: string | undefined;
    borderColor?: string | undefined;
    borderWidth?: number | undefined;
    borderRadius?: number | undefined;
    textAlign?: "left" | "center" | "right" | undefined;
    letterSpacing?: number | undefined;
    lineHeight?: number | undefined;
    opacity?: number | undefined;
    textTransform?: "none" | "uppercase" | "lowercase" | "capitalize" | undefined;
}

export interface CertificateElement {
    id: string;
    type: CertificateElementType;
    x: number; // in pt
    y: number; // in pt
    width: number; // in pt
    height: number; // in pt
    rotation?: number | undefined;
    zIndex: number;
    style?: CertificateElementStyle | undefined;
    fieldKey?: string | undefined;
    text?: string | undefined;
    imageUrl?: string | undefined;
    fallbackValue?: string | undefined;
    fitPolicy?: "shrink" | "wrap" | "warn" | undefined;
    isLocked?: boolean | undefined;
    isHidden?: boolean | undefined;
    shapeType?: "rectangle" | "circle" | "line" | "star" | string | undefined;
    strokeColor?: string | undefined;
    strokeWidth?: number | undefined;
    fillColor?: string | undefined;
    cornerRadius?: number | undefined;
    signerName?: string | undefined;
    signerTitle?: string | undefined;
    signatureUrl?: string | undefined;
    imageFit?: "contain" | "cover" | undefined;
    iconName?: string | undefined;
    isRequired?: boolean | undefined;
    minFontSize?: number | undefined;
    maxFontSize?: number | undefined;
    maxLines?: number | undefined;
    dataType?: "text" | "number" | "date" | "url" | undefined;
}

export interface CustomAttributeDefinition {
    key: string;
    label: string;
    dataType: "text" | "number" | "date" | "url";
    isRequired?: boolean | undefined;
    scope: "all" | "individual" | "team";
    sampleValue: string;
    description?: string | undefined;
}

export interface CertificateDesign {
    style?: string | undefined;
    subcategory?: string | undefined;
    aspectRatio?: string | undefined;
    customAttributes?: CustomAttributeDefinition[] | undefined;
    page: {
        width: number;
        height: number;
        orientation: CertificateOrientation;
        unit: "pt";
    };
    background: {
        type: "color" | "gradient" | "image" | "preset";
        color?: string | undefined;
        gradient?: string | undefined;
        imageUrl?: string | undefined;
        fit?: "cover" | "contain" | "stretch" | undefined;
        borderStyle?: "double" | "solid" | "ornate" | "modern" | "neo-brutalist" | "none" | undefined;
        borderColor?: string | undefined;
        borderWidth?: number | undefined;
        accentColor?: string | undefined;
    };
    elements: CertificateElement[];
}

export interface CertificateTemplateRecord {
    id: string;
    clubId: string | null;
    ownerClubName?: string | undefined;
    creatorName?: string | undefined;
    usageCount?: number | undefined;
    pageSizeLabel?: string | undefined;
    isSystem: boolean;
    name: string;
    category: string;
    subcategory?: string | undefined;
    style?: string | undefined;
    aspectRatio?: string | undefined;
    design: CertificateDesign;
    backgroundAssetUrl?: string | null | undefined;
    backgroundFit: "cover" | "contain" | "stretch";
    orientation: CertificateOrientation;
    pageWidth: number;
    pageHeight: number;
    version: number;
    status: "draft" | "published" | "archived";
    thumbnailUrl?: string | null | undefined;
    createdBy?: string | null | undefined;
    createdAt: string;
    updatedAt: string;
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
