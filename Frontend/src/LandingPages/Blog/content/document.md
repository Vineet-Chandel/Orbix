<!--
================================================================================
AWS CLOUD LAUNCHPAD — DEPLOYMENT WORKBOOK
================================================================================
PLACEHOLDER DOCUMENTATION SOURCE FILE

INSTRUCTIONS FOR THE AUTHOR:
1. Paste or write your complete AWS Cloud Launchpad documentation in this file.
2. The application dynamically derives the table of contents from H1, H2, and H3
   headings, tracks active sections as the reader scrolls, provides full-text search,
   adds syntax highlighting and copy buttons to code blocks, and styles tables and
   callouts responsively.
3. You can replace everything below this comment block with your final text.
================================================================================
-->

# AWS Cloud Launchpad: Deployment Workbook

> **Document Status**: Production Ready · **Version**: 1.0.0 · **Target Audience**: Engineers, Architects, and Builders deploying their first production-grade web workload to AWS.

Welcome to the **AWS Cloud Launchpad Deployment Workbook**. This technical manual guides you through every step required to take a modern web application from a local repository to a resilient, secure, and observable deployment on Amazon Web Services.

Whether you are configuring your initial virtual private cloud (VPC), orchestrating container workloads, or wiring custom domains with SSL/TLS certificates, this workbook provides the operational checklists, configuration templates, and architectural patterns you need.

---

## 1. Architectural Overview & Prerequisites

Before initiating any infrastructure provisioning, verify that your environment satisfies the baseline technical prerequisites and that your team aligns on the core architecture.

### 1.1 Deployment Topology

A well-architected deployment separates concerns into distinct network layers:

- **Edge Layer**: Global content delivery and DNS routing with DDoS protection.
- **Public Subnet Layer**: Application Load Balancers and managed NAT Gateways.
- **Private Compute Layer**: Containerized tasks (ECS/EKS) or autoscaled virtual machines (EC2) without direct internet ingress.
- **Data Persistence Layer**: Isolated database clusters (RDS Aurora) and encrypted object storage (S3) with restricted VPC endpoints.

> [!NOTE]
> All compute instances reside in private subnets across multiple Availability Zones (AZs). Outbound internet connectivity for package downloads or third-party APIs is routed strictly through NAT Gateways.

### 1.2 Baseline Prerequisites Checklist

Review the following operational checklist before running deployment commands:

- [x] AWS Account activated with root MFA enabled
- [x] Dedicated IAM administrative user or IAM Identity Center role configured
- [x] AWS CLI v2 installed and configured locally (`aws --version`)
- [x] Infrastructure-as-Code tooling installed (Terraform, AWS CDK, or CloudFormation)
- [ ] Registered public domain name with active Route 53 hosted zone
- [ ] Docker engine running locally for container builds
- [ ] Production environment secrets and API keys cataloged in AWS Secrets Manager

---

## 2. Network Infrastructure & Security Boundaries

Network isolation is the foundation of cloud security. In this phase, we establish an isolated Virtual Private Cloud (VPC) spanning two Availability Zones.

### 2.1 Subnet Allocation Matrix

The table below outlines the IP address planning and subnet topology for a standard `/16` CIDR block:

| Subnet Name | Availability Zone | CIDR Block | Route Target | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `public-subnet-1a` | `us-east-1a` | `10.0.1.0/24` | Internet Gateway (`igw-xxxx`) | Application Load Balancer |
| `public-subnet-1b` | `us-east-1b` | `10.0.2.0/24` | Internet Gateway (`igw-xxxx`) | Application Load Balancer |
| `private-app-1a` | `us-east-1a` | `10.0.11.0/24` | NAT Gateway 1a | Web App Services / ECS |
| `private-app-1b` | `us-east-1b` | `10.0.12.0/24` | NAT Gateway 1b | Web App Services / ECS |
| `private-db-1a` | `us-east-1a` | `10.0.21.0/24` | Local VPC Only | RDS Aurora Primary |
| `private-db-1b` | `us-east-1b` | `10.0.22.0/24` | Local VPC Only | RDS Aurora Replica |

> [!TIP]
> Always allocate CIDR ranges with room for future growth. A `/24` gives you 251 usable IP addresses per subnet after subtracting the five addresses AWS reserves automatically.

### 2.2 Security Group Definitions

Security groups act as stateful firewalls at the network interface level. Apply the principle of least privilege:

```bash
# Verify existing security groups in the target VPC
aws ec2 describe-security-groups \
  --filters "Name=vpc-id,Values=vpc-0a1b2c3d4e5f6g7h8" \
  --query "SecurityGroups[*].{ID:GroupId,Name:GroupName,Description:Description}" \
  --output table
```

Here is a sample ingress rule configuration in JSON format for the Application Load Balancer:

```json
{
  "SecurityGroupRule": {
    "IpProtocol": "tcp",
    "FromPort": 443,
    "ToPort": 443,
    "CidrIpv4": "0.0.0.0/0",
    "Description": "Allow inbound HTTPS traffic from the public internet"
  }
}
```

> [!WARNING]
> Never open port `22` (SSH) or port `3306`/`5432` (databases) directly to `0.0.0.0/0`. Use AWS Systems Manager Session Manager (SSM) for secure shell access without opening inbound ports.

---

## 3. Containerization & Registry Setup

Modern cloud deployments package applications into lightweight, immutable OCI container images.

### 3.1 Production Dockerfile Specification

Ensure your build process uses multi-stage builds to keep image sizes small and minimize vulnerability surfaces:

```dockerfile
# Stage 1: Build dependencies and bundle assets
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# Stage 2: Minimal runtime image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nodejs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nodejs:nextjs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

### 3.2 Amazon ECR Authentication and Push

Authenticate your local Docker daemon against Amazon Elastic Container Registry (ECR) and push your versioned container tag:

```bash
# Step 1: Retrieve an authentication token and authenticate Docker
aws ecr get-login-password --region us-east-1 | docker login \
  --username AWS \
  --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

# Step 2: Tag the local build image with the remote registry URI
docker tag my-app:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/launchpad-app:v1.0.0

# Step 3: Push the image to Amazon ECR
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/launchpad-app:v1.0.0
```

---

## 4. Compute Orchestration with AWS ECS Fargate

AWS Fargate enables serverless container execution so you do not need to manage, patch, or scale underlying EC2 virtual machines.

### 4.1 Task Definition Blueprint

The task definition declares CPU, memory, log drivers, and container environment variables:

```yaml
version: "1.0"
taskDefinition:
  family: "launchpad-backend"
  cpu: "512"
  memory: "1024"
  networkMode: "awsvpc"
  requiresCompatibilities:
    - "FARGATE"
  executionRoleArn: "arn:aws:iam::123456789012:role/ecsTaskExecutionRole"
  taskRoleArn: "arn:aws:iam::123456789012:role/ecsAppTaskRole"
  containerDefinitions:
    - name: "web-server"
      image: "123456789012.dkr.ecr.us-east-1.amazonaws.com/launchpad-app:v1.0.0"
      portMappings:
        - containerPort: 3000
          hostPort: 3000
          protocol: "tcp"
      logConfiguration:
        logDriver: "awslogs"
        options:
          awslogs-group: "/ecs/launchpad-backend"
          awslogs-region: "us-east-1"
          awslogs-stream-prefix: "ecs"
```

### 4.2 Health Checks and Graceful Termination

Configure the container health check to respond with HTTP `200 OK` on `/api/health`.

```javascript
// Example Express.js health probe route
app.get('/api/health', async (req, res) => {
  try {
    // Verify database connectivity
    await db.query('SELECT 1');
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});
```

> [!IMPORTANT]
> Ensure the target group health check path matches your application's probe endpoint. The default timeout should be 5 seconds with an unhealthy threshold of 2 attempts.

---

## 5. Domain Configuration, SSL/TLS, and Edge Routing

Connecting your application to the public internet requires secure DNS mapping and automatic TLS certificate renewals.

### 5.1 Route 53 and ACM Certificate Setup

1. **Request Certificate**: Open AWS Certificate Manager (ACM) in `us-east-1` (required for CloudFront distributions) or your service region.
2. **DNS Validation**: Create the CNAME validation records in Amazon Route 53 with a single click.
3. **Wait for Issuance**: Certificates typically issue within 5–15 minutes once DNS propagation finishes.

### 5.2 CloudFront Distribution Settings

A global CDN provides caching at edge locations around the world, reducing latency and shielding your origin server:

- **Origin**: Point directly to your Application Load Balancer DNS name over HTTPS.
- **Viewer Protocol Policy**: Select `Redirect HTTP to HTTPS`.
- **Allowed HTTP Methods**: `GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE`.
- **Cache Policy**: `CachingOptimized` for static assets, `CachingDisabled` for dynamic API paths.

---

## 6. Observability, Logging, and Post-Launch Runbook

A production deployment is only complete when monitoring, alarms, and incident procedures are operational.

### 6.1 Core CloudWatch Metrics

Monitor these essential operational metrics across your service:

| Metric Name | Service | Normal Range | Alert Threshold | Action Required |
| :--- | :--- | :--- | :--- | :--- |
| `CPUUtilization` | ECS Fargate | 20% – 60% | > 85% for 5 min | Scale out task count |
| `TargetResponseTime` | ALB | 20ms – 120ms | > 500ms for 3 min | Inspect slow database queries |
| `HTTPCode_Target_5XX_Count` | ALB | 0 errors | > 10 errors in 1 min | Check container application logs |
| `DatabaseConnections` | RDS | 10 – 50 | > 180 connections | Investigate connection pool leakage |

### 6.2 Emergency Rollback Procedure

If a critical defect is identified post-launch, invoke the automated rollback procedure:

```bash
# Roll back ECS service to previous stable task definition revision
aws ecs update-service \
  --cluster launchpad-production \
  --service launchpad-backend \
  --task-definition launchpad-backend:14 \
  --force-new-deployment
```

### 6.3 Verification Sign-off

Before signing off on the production milestone, confirm all acceptance criteria:

- [x] HTTPS certificate verified with A+ rating on SSL Labs
- [x] Application Load Balancer gracefully draining connections
- [x] Database automated backups enabled with 7-day retention
- [x] CloudWatch composite alarm wired to Slack/Email alerting
- [ ] Staging-to-production deployment pipeline automated in CI/CD

---

<!--
================================================================================
END OF PLACEHOLDER DOCUMENT
Replace this entire file with your official AWS Cloud Launchpad text.
================================================================================
-->
