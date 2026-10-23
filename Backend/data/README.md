# Official Indian Institution Data Pipeline & Verification Manifest

## 1. Official Government & Regulatory Data Sources

| Authority | System / Dataset | Official Portal | Identifier Scheme | Update Frequency | Public Accessibility | Coverage Scope |
|:---|:---|:---|:---|:---|:---|:---|
| **Ministry of Education (MoE)** | **AISHE** (All India Survey on Higher Education) | [aishe.gov.in](https://aishe.gov.in) / [dashboard.aishe.gov.in](https://dashboard.aishe.gov.in/hedirectory/) | `U-XXXX` (Universities), `C-XXXXX` (Colleges), `S-XXXX` (Standalone) | Annual (academic cycle) | Public directory & annual report tables | Complete census of ~1,168 Universities & ~45,000+ Colleges |
| **University Grants Commission (UGC)** | Consolidated List of All Universities (Section 2(f) & 12(B)) | [ugc.gov.in](https://www.ugc.gov.in) | Gazetted registration number / UGC State-wise serial | Monthly/Quarterly notifications | Public PDF & HTML registers | Central, State, Private, and Deemed-to-be Universities |
| **All India Council for Technical Education (AICTE)** | AICTE Approved Institutes Directory | [facilities.aicte-india.org](https://facilities.aicte-india.org/dashboard/pages/angulardashboard.php) | AICTE Permanent Institute ID (`1-XXXXXXXXXX`) | Annual Approval Process Handbook cycle | Public search directory | Technical, Engineering, Management, MCA, Pharmacy institutions |
| **National Institutional Ranking Framework (NIRF)** | NIRF Ranked Institutions Directory | [nirfindia.org](https://www.nirfindia.org) | NIRF College / University ID (`IR-X-XXXX`) | Annual | Public ranking data tables | Top 100-200 ranked institutions across categories |

---

## 2. Ingestion & Verification Methodology

### Strict Verification Standard
In this system, an institution is assigned `verification_status = 'verified'` **strictly when directly traceable to an official primary source**:
- Must possess a verified **AISHE Code** (`U-` or `C-` prefix) published in MoE gazette/directories.
- Must link to the authoritative statutory basis (e.g. *Institutes of National Importance Act*, *UGC Act 1956 Section 2(f)/12(B)*, or *AICTE Approval Register*).
- Any institution without official primary registry evidence remains `unverified` or queued under `institution_verification_requests`.

### Automated Normalization Pipeline
1. **Case & Punctuation Normalization**:
   - Strip commas, periods, hyphens, and brackets.
   - Collapse whitespace, convert to lowercase for exact prefix searching.
2. **Alias & Acronym Derivation**:
   - Automatically derives acronyms (e.g. "Indian Institute of Technology Bombay" -> "IITB", "IIT Bombay").
   - Indexes historical identities (e.g. "DCE" for "Delhi Technological University", "REC Trichy" for "NIT Trichy", "VJTI" for "Veermata Jijabai Technological Institute").
3. **Audit Trail & Provenance**:
   - Every verified institution record links to `institution_sources` (source name, URL, retrieval year, confirmation status) and `institution_regulatory_ids`.

---

## 3. Dataset Coverage & Limitations
- **Current Curated Tier-1/Tier-2 Dataset**: Covers all 23 IITs, all 31 NITs, premier IIITs, BITS Pilani campuses, central universities, top state technological universities (COEP, VJTI, DTU, NSUT, Anna Univ, Jadavpur Univ), and premier accredited private universities across 18+ States/UTs.
- **Handling Gaps**: When a user's institution is missing from the verified dataset, the system offers the **"Request Verification"** flow instead of freeform unchecked typing. Admins can review the request against AISHE/UGC records before granting verified status.

---

## 4. Running the Ingestion Pipeline
To ingest or re-sync the verified institution dataset into PostgreSQL (Supabase):
```bash
cd Backend
npm run seed:institutions  # or: npx tsx data/seed_institutions.ts
```
The script runs idempotently with `ON CONFLICT (aishe_code) DO UPDATE`.
