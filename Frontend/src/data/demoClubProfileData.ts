import { MANDALA_BANNER_URL } from "../LandingPages/Main-Landing-Pages/Personal-Account-Landing-Pages/clubs/mockClubs";
import { PRESET_EVENT_BANNERS } from "../components/EventBanners/presetEventBanners";

export const DEMO_CLUB_SLUG = "aws-swg-psit";

/**
 * Normalizes and checks if a given slug corresponds to the demo club profile
 */
export { isDemoClubSlug } from "../../../shared/seo/demoClub";

export interface DemoClubDataBundle {
    club: any;
    coordinators: any[];
    achievements: any[];
    teams: any[];
    upcomingEvents: any[];
    pastEvents: any[];
}

export const demoClubProfile = {
    id: "demo-club-aws-swg-psit",
    name: "AWS SWG PSIT",
    slug: DEMO_CLUB_SLUG,
    category: "Cloud Computing & DevOps",
    collegeName: "Pranveer Singh Institute of Technology, Kanpur",
    collegeCity: "Kanpur",
    collegeState: "Uttar Pradesh",
    collegeCountry: "India",
    shortDescription:
        "Official collegiate AWS Student Working Group advancing Cloud Architecture, Serverless Systems, DevOps CI/CD, and AWS Certifications at PSIT Kanpur.",
    about: `## About AWS SWG PSIT • Pranveer Singh Institute of Technology

The **AWS Student Working Group at Pranveer Singh Institute of Technology (PSIT), Kanpur** is an officially recognized, student-led collegiate cloud community. Dedicated to democratizing cloud engineering and hands-on infrastructure skills, the chapter serves as an institutional launchpad for aspiring Cloud Solutions Architects, DevOps Engineers, and Serverless Developers across North India.

### Cloud Architecture & Hands-on Console Labs
We believe mastery in cloud systems is developed through active architectural problem-solving, real console deployments, and well-architected cost optimization.
- **Weekly Cloud Sandboxes:** Every weekend, our members build multi-tier infrastructures covering Amazon EC2, VPC Peering, S3 lifecycle policies, Application Load Balancers, and Aurora Serverless databases.
- **AWS Certification Accelerators:** Structured study cohorts tailored for **AWS Certified Cloud Practitioner (CLF-C02)** and **AWS Solutions Architect Associate (SAA-C03)**, complete with timed mock exams and hands-on labs.
- **Well-Architected Review Pods:** Interactive sessions analyzing real enterprise failure modes across the 6 AWS Well-Architected Framework pillars (Security, Reliability, Performance Efficiency, Cost Optimization, Operational Excellence, and Sustainability).

### DevOps Automation, Serverless & Infrastructure as Code
Beyond basic compute hosting, our students build automated, scalable deployment pipelines:
- **Infrastructure as Code (IaC):** Writing reproducible cloud topology using **Terraform** and **AWS CDK (TypeScript)** with state locking and automated drift detection.
- **Serverless & Event-Driven Systems:** Developing microservices with **AWS Lambda**, **Amazon EventBridge**, **SQS/SNS**, and **DynamoDB single-table design** for low-latency, zero-idle-cost campus platforms.
- **Containerization & Kubernetes:** Packaging microservices in Docker and orchestrating container workloads using **Amazon ECS Fargate** and **Amazon EKS**.

### AWS Community Days, DeepRacer & Hackathons
The working group maintains active connections with the AWS User Group (UG) network, AWS Community Builders, and developer communities nationwide. Through Orbix, we orchestrate inter-college cloud hackathons, AWS DeepRacer autonomous racing leagues, and collaborative project showcases.`,
    logoUrl: "https://res.cloudinary.com/dj0ivep44/image/upload/v1794761081/8cd940c9-9253-4fe3-9d19-66500da7b42d.png",
    coverImageUrl: "https://res.cloudinary.com/dj0ivep44/image/upload/v1794761105/96eb5c33-f981-4018-a18c-c3f778b75f0b.png",
    websiteUrl: "https://awsswg.psit.ac.in",
    publicEmail: "a***@psit.ac.in",
    contactPhone: "91********10",
    links: [
        {
            platform: "website",
            url: "https://awsswg.psit.ac.in",
            label: "Chapter Portal",
        },
        {
            platform: "github",
            url: "https://github.com/aws-swg-psit",
            label: "Cloud & DevOps Repos",
        },
        {
            platform: "linkedin",
            url: "https://linkedin.com/company/aws-swg-psit",
            label: "LinkedIn Network",
        },
        {
            platform: "discord",
            url: "https://discord.gg/aws-swg-psit",
            label: "Cloud Builders Community",
        },
    ],
    socialLinks: {
        github: "https://github.com/aws-swg-psit",
        linkedin: "https://linkedin.com/company/aws-swg-psit",
        x: "https://x.com/aws_swg_psit",
        discord: "https://discord.gg/aws-swg-psit",
        youtube: "https://youtube.com/@awsswgpsit",
    },
    foundedYear: 2023,
    operatingStatus: "active" as const,
    mission:
        "Accelerate cloud adoption across academia, empower undergraduates with verified AWS Certifications, and architect production-grade serverless and distributed systems.",
    vision:
        "To establish PSIT Kanpur as North India's premier collegiate cloud center of excellence, bridging student developers directly to high-impact cloud architecture and DevOps careers.",
    focusAreas: [
        "AWS Cloud",
        "Cloud Architecture",
        "DevOps",
        "Serverless",
        "Docker & Kubernetes",
        "AWS Certifications",
        "Solutions Architect",
        "Terraform / CDK",
        "Cloud Security",
    ],
    publicationStatus: "published" as const,
    profileVisibility: "public" as const,
    visibility: "public" as const,
    recruitmentStatus: "open" as const,
    recruitmentAnnouncement:
        "Spring '26 Cloud Apprenticeship & Technical Leads recruitment is live! Tracks for Solutions Architecture, DevOps Automation, Serverless & AWS Certifications. Applications open until November 30.",
    recruitmentUrl: "https://orbix.dev/join/aws-swg-psit",
    verifiedAt: "2025-08-15T00:00:00Z",
    createdAt: "2023-09-01T00:00:00Z",
};

export const demoClubCoordinators = [
    {
        id: "coord-demo-1",
        name: "Vineet Chandel",
        department: "Computer Science & Engineering",
        role: "Lead Coordinator & Cloud Solutions Architect",
        imageUrl: "https://res.cloudinary.com/dj0ivep44/image/upload/v1794761081/8cd940c9-9253-4fe3-9d19-66500da7b42d.png",
        isPrimary: true,
        contactEmail: "v***@orbix.dev",
        linkedinUrl: "https://linkedin.com/in/vineetchandel",
        linkedUsername: "Vineet-Chandel",
        linkedDisplayName: "Vineet Chandel",
        linkedAvatarUrl: "https://res.cloudinary.com/dj0ivep44/image/upload/v1794761081/8cd940c9-9253-4fe3-9d19-66500da7b42d.png",
    },
    {
        id: "coord-demo-2",
        name: "Krishna Tripathi",
        department: "Information Technology",
        role: "DevOps & Cloud Infrastructure Lead (AWS SAA-C03)",
        imageUrl: null,
        isPrimary: false,
        contactEmail: "k***@orbix.dev",
        linkedinUrl: "https://linkedin.com/in/krishnatripathi",
        linkedUsername: "krishna_tripathi",
        linkedDisplayName: "Krishna Tripathi",
        linkedAvatarUrl: null,
    },
    {
        id: "coord-demo-3",
        name: "Ananya Sharma",
        department: "Computer Science (AI & ML)",
        role: "Serverless & Cloud-Native Systems Lead",
        imageUrl: null,
        isPrimary: false,
        contactEmail: "a***@orbix.dev",
        linkedinUrl: "https://linkedin.com/in/ananyasharma",
        linkedUsername: "ananya_codes",
        linkedDisplayName: "Ananya Sharma",
        linkedAvatarUrl: null,
    },
    {
        id: "coord-demo-4",
        name: "Devansh Verma",
        department: "Computer Science & Engineering",
        role: "Cloud Community & Certification Mentor",
        imageUrl: null,
        isPrimary: false,
        contactEmail: "d***@orbix.dev",
        linkedinUrl: "https://linkedin.com/in/devanshverma",
        linkedUsername: "devansh_v",
        linkedDisplayName: "Devansh Verma",
        linkedAvatarUrl: null,
    },
];

export const demoClubAchievements = [
    {
        id: "ach-demo-1",
        title: "AWS Community Day Hackathon Champions 2025",
        type: "Cloud Hackathon",
        description: "Won 1st place across North India for architecting an ultra low-latency disaster alerting system using AWS Lambda, DynamoDB Global Tables, and IoT Core.",
        achievementDate: "October 2025",
        issuer: "AWS User Group North India / Amazon Web Services",
        imageUrl: null,
        externalLink: "https://aws.amazon.com/developer/community",
    },
    {
        id: "ach-demo-2",
        title: "120+ Students AWS Certified (Cloud Practitioner & Solutions Architect)",
        type: "Institutional Milestone",
        description: "Achieved 100% pass rate in collegiate AWS Certification cohorts with 80+ AWS Certified Cloud Practitioners and 40+ Solutions Architect Associates.",
        achievementDate: "August 2025",
        issuer: "AWS Academy & Training and Certification",
        imageUrl: null,
        externalLink: "https://aws.amazon.com/certification",
    },
    {
        id: "ach-demo-3",
        title: "AWS DeepRacer Student League - Top 10 National Finalists",
        type: "Autonomous AI & Cloud",
        description: "Trained reinforcement learning models using AWS SageMaker and RoboMaker to secure 7th place in the Pan-India AWS DeepRacer Student Finals.",
        achievementDate: "May 2025",
        issuer: "AWS DeepRacer Student League",
        imageUrl: null,
        externalLink: "https://deepracerstudent.com",
    },
    {
        id: "ach-demo-4",
        title: "Winner - Smart India Hackathon '24 (Cloud-Native Track)",
        type: "National Hackathon",
        description: "Built a resilient serverless crop disease diagnosis pipeline using AWS Bedrock foundation models, S3, and API Gateway.",
        achievementDate: "September 2024",
        issuer: "Ministry of Education Innovation Cell (Govt of India)",
        imageUrl: null,
        externalLink: "https://sih.gov.in",
    },
];

export const demoClubTeams = [
    {
        id: "team-demo-1",
        name: "Cloud Architecture & Solutions Wing",
        slug: "cloud-architecture",
        description: "Designs highly available, fault-tolerant infrastructure blueprints on AWS. Focuses on VPC networking, EC2 Auto Scaling, RDS multi-AZ, and Well-Architected reviews.",
        responsibilities: "VPC Networking, High Availability Blueprints, AWS Well-Architected Framework, SAA-C03 Cohorts",
        memberCount: 38,
    },
    {
        id: "team-demo-2",
        name: "DevOps & Cloud-Native Core",
        slug: "devops-ci-cd",
        description: "Builds automated continuous integration and continuous deployment pipelines, Infrastructure as Code with Terraform and AWS CDK, and Kubernetes clusters on EKS.",
        responsibilities: "Terraform, AWS CDK, GitHub Actions, Docker, Amazon EKS, Monitoring & Grafana",
        memberCount: 26,
    },
    {
        id: "team-demo-3",
        name: "Serverless & Distributed Systems",
        slug: "serverless-distributed-systems",
        description: "Engineers event-driven architectures with AWS Lambda, EventBridge, SQS/SNS, and DynamoDB single-table design for zero-idle-cost campus applications.",
        responsibilities: "AWS Lambda, DynamoDB, API Gateway, EventBridge, AppSync GraphQL, Go & TypeScript microservices",
        memberCount: 22,
    },
    {
        id: "team-demo-4",
        name: "Certification & Peer Mentorship Guild",
        slug: "certification-mentorship",
        description: "Drives curriculum cohorts for AWS Academy Cloud Foundations, conducts hands-on console labs, and distributes exam prep material and practice vouchers.",
        responsibilities: "AWS Academy Labs, Cloud Practitioner Exam Cram, Mock Tests, Voucher Distribution",
        memberCount: 15,
    },
];

export const demoClubUpcomingEvents = [
    {
        id: "ev-demo-cloud-immersion",
        clubId: "demo-club-aws-swg-psit",
        title: "AWS Cloud Immersion Day: Zero to Solutions Architect '26",
        slug: "aws-cloud-immersion-day-zero-to-architect-26",
        summary: "Full-day intensive workshop building multi-tier production architectures with VPC, Application Load Balancers, ECS Fargate, and Aurora Serverless.",
        description: "Hands-on architectural masterclass led by AWS Certified professionals. Students configure secure VPCs, private subnets, bastion hosts, containerized web apps, and automated database backups with verified Orbix participation credentials.",
        startsAt: "2026-11-28T09:30:00+05:30",
        endsAt: "2026-11-28T17:30:00+05:30",
        timezone: "Asia/Kolkata",
        locationType: "in_person" as const,
        venueOrLocation: "Advanced Cloud Computing Center (Lab 5), PSIT Kanpur",
        registrationUrl: "https://orbix.dev/events/aws-cloud-immersion-day-zero-to-architect-26/register",
        coverImageUrl: "https://res.cloudinary.com/dj0ivep44/image/upload/v1794761105/96eb5c33-f981-4018-a18c-c3f778b75f0b.png",
        publishedAt: "2026-11-01T00:00:00+05:30",
        createdAt: "2026-11-01T00:00:00+05:30",
        status: "published" as const,
        scope: "CAMPUS" as const,
        isTeamEvent: true,
        minTeamSize: 2,
        maxTeamSize: 4,
        registrationsCount: 48,
        attendeesCount: 0,
        likesCount: 19,
    },
    {
        id: "ev-demo-serverless-sprint",
        clubId: "demo-club-aws-swg-psit",
        title: "Serverless Microservices Sprint: Building with AWS Lambda & DynamoDB",
        slug: "serverless-microservices-sprint-lambda-dynamodb",
        summary: "3-hour live code-along constructing an event-driven payment & notification webhook service with 100% serverless AWS services.",
        description: "Learn single-table DynamoDB design, async event processing with SQS, and API Gateway authentication. Participants deploy live endpoints to personal AWS sandbox accounts.",
        startsAt: "2026-11-22T16:00:00+05:30",
        endsAt: "2026-11-22T19:00:00+05:30",
        timezone: "Asia/Kolkata",
        locationType: "online" as const,
        venueOrLocation: "Virtual AWS Cloud Lab • Orbix Live Stream & Discord Voice",
        registrationUrl: null,
        coverImageUrl: PRESET_EVENT_BANNERS[0]?.dataUrl || MANDALA_BANNER_URL,
        publishedAt: "2026-11-10T00:00:00+05:30",
        createdAt: "2026-11-10T00:00:00+05:30",
        status: "published" as const,
        scope: "PAN_INDIA" as const,
        isTeamEvent: false,
        registrationsCount: 85,
        attendeesCount: 0,
        likesCount: 34,
    },
];

export const demoClubPastEvents = [
    {
        id: "ev-demo-past-1",
        clubId: "demo-club-aws-swg-psit",
        title: "AWS DeepRacer Autonomous Racing Masterclass 2025",
        slug: "aws-deepracer-autonomous-racing-masterclass-2025",
        summary: "Hands-on reinforcement learning workshop training reward functions for 1/18th scale AWS autonomous race cars.",
        description: "Over 120 student coders trained neural network models in AWS Console, evaluated waypoint tracking, and submitted laps to the official campus leaderboard.",
        startsAt: "2025-10-18T10:00:00+05:30",
        endsAt: "2025-10-18T16:00:00+05:30",
        timezone: "Asia/Kolkata",
        locationType: "in_person" as const,
        venueOrLocation: "Campus Auditorium & Robotics Arena, PSIT Kanpur",
        registrationUrl: null,
        coverImageUrl: null,
        publishedAt: "2025-10-01T00:00:00+05:30",
        createdAt: "2025-10-01T00:00:00+05:30",
        status: "completed" as const,
        scope: "CAMPUS" as const,
        isTeamEvent: true,
        minTeamSize: 2,
        maxTeamSize: 3,
        registrationsCount: 120,
        attendeesCount: 114,
        likesCount: 52,
    },
    {
        id: "ev-demo-past-2",
        clubId: "demo-club-aws-swg-psit",
        title: "Terraform on AWS: Infrastructure as Code from Scratch",
        slug: "terraform-on-aws-iac-from-scratch",
        summary: "Zero-to-hero workshop provisioning immutable cloud infrastructure across multiple AWS availability zones with Terraform.",
        description: "Hands-on deployment of VPCs, security groups, EC2 autoscaling groups, and S3 state locking with DynamoDB.",
        startsAt: "2025-09-12T11:00:00+05:30",
        endsAt: "2025-09-12T15:30:00+05:30",
        timezone: "Asia/Kolkata",
        locationType: "in_person" as const,
        venueOrLocation: "Seminar Hall 2, PSIT Kanpur",
        registrationUrl: null,
        coverImageUrl: null,
        publishedAt: "2025-09-01T00:00:00+05:30",
        createdAt: "2025-09-01T00:00:00+05:30",
        status: "completed" as const,
        scope: "CAMPUS" as const,
        isTeamEvent: false,
        registrationsCount: 92,
        attendeesCount: 88,
        likesCount: 29,
    },
];

/**
 * Returns the full bundle for the demo club profile
 */
export function getDemoClubProfileBundle(_slug?: string): DemoClubDataBundle {
    return {
        club: demoClubProfile,
        coordinators: demoClubCoordinators,
        achievements: demoClubAchievements,
        teams: demoClubTeams,
        upcomingEvents: demoClubUpcomingEvents,
        pastEvents: demoClubPastEvents,
    };
}
