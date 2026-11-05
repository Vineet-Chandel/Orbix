import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Shield,
  ArrowLeft,
  Calendar,
  FileText,
  Lock,
  Mail,
  Copy,
  Printer,
  ChevronRight
} from "lucide-react";
import { useToast } from "../../context/ToastContext";

interface Section {
  id: string;
  title: string;
}

const SECTIONS: Section[] = [
  { id: "operator-identity", title: "1. Operator Identity & Status" },
  { id: "scope-overview", title: "2. Scope & Applicability" },
  { id: "information-collected", title: "3. Categories of Information Collected" },
  { id: "processing-purposes", title: "4. Purposes & Legal Basis of Processing" },
  { id: "minor-protection", title: "5. Age Eligibility & Minor Attendee Consent" },
  { id: "user-content-ownership", title: "6. User Content & Intellectual Property" },
  { id: "third-party-processors", title: "7. Data Processors & Sub-processors" },
  { id: "security-measures", title: "8. Data Security & Technical Safeguards" },
  { id: "retention-deletion", title: "9. Data Retention & 7-Day Deletion Protocol" },
  { id: "user-rights", title: "10. User Rights & Privacy Controls" },
  { id: "cookies-tracking", title: "11. Cookies, Telemetry & Local Storage" },
  { id: "governing-law", title: "12. Governing Law & Dispute Resolution" },
  { id: "amendments", title: "13. Amendments & Version History" },
  { id: "contact-redressal", title: "14. Grievance Redressal & Contact" },
];

export const PrivacyPolicyPage: React.FC = () => {
  const toast = useToast();
  const [activeSection, setActiveSection] = useState<string>("operator-identity");

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;
      for (const section of SECTIONS) {
        const element = document.getElementById(section.id);
        if (element) {
          const top = element.offsetTop;
          const height = element.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const yOffset = -90;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
      setActiveSection(id);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Privacy Policy link copied to clipboard!", { title: "Link Copied" });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#FAF6EE] text-black font-sans antialiased selection:bg-[#a2ff86] selection:text-black">
      {/* Top Utility & Brand Bar */}
      <header className="sticky top-0 z-50 bg-[#FAF6EE]/95 backdrop-blur-md border-b-2 border-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 text-sm font-black uppercase tracking-wider px-3 py-1.5 bg-white border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#a2ff86] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Orbix</span>
            </Link>
            <div className="hidden sm:flex items-center gap-2 font-mono text-xs">
              <span className="font-bold text-zinc-600">LEGAL</span>
              <span className="text-zinc-400">/</span>
              <span className="font-black text-black">PRIVACY POLICY</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              title="Copy Page Link"
              className="p-2 bg-white border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FFE566] transition-colors"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={handlePrint}
              title="Print Document"
              className="p-2 bg-white border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FFE566] transition-colors"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="border-b-2 border-black bg-white px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#a2ff86] border-2 border-black font-black text-xs uppercase tracking-wider rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Shield className="w-3.5 h-3.5" />
              Official Legal Document
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FFE566] border-2 border-black font-mono font-bold text-xs rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              Version 1.0
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border-2 border-black font-mono text-xs rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Calendar className="w-3.5 h-3.5 text-zinc-500" />
              Effective Date: November 2026
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-black uppercase mb-4">
            Orbix Privacy Policy
          </h1>

          <p className="text-base sm:text-lg text-zinc-700 max-w-3xl leading-relaxed font-medium">
            This Privacy Policy governs the collection, processing, storage, and protection of personal data across the
            Orbix Platform. We are committed to complete transparency, verifiable data ownership, and robust protection
            of developer identity and privacy rights.
          </p>

          {/* Quick Notice Callout */}
          <div className="mt-8 p-4 bg-[#FAF6EE] border-2 border-black rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-[#a2ff86] border-2 border-black flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-black" />
              </div>
              <div>
                <p className="font-black text-sm uppercase">Our Core Privacy Pledge</p>
                <p className="text-xs text-zinc-600">
                  Zero sale of developer code or personal resumes. Dedicated 7-day cancellation grace period for account deletion. Verifiable parental consent for collegiate event attendees under 18.
                </p>
              </div>
            </div>
            <Link
              to="/settings"
              className="text-xs font-black uppercase tracking-wider px-3 py-2 bg-black text-white border-2 border-black rounded hover:bg-zinc-800 transition-colors shrink-0"
            >
              Open Privacy Center
            </Link>
          </div>
        </div>
      </section>

      {/* Main Content Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* Sticky Table of Contents (Desktop) */}
          <aside className="hidden lg:block lg:col-span-4 sticky top-24">
            <div className="bg-white border-2 border-black rounded-lg p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-h-[calc(100vh-8rem)] overflow-y-auto">
              <div className="flex items-center gap-2 pb-3 mb-3 border-b-2 border-black">
                <FileText className="w-4 h-4 text-black" />
                <h2 className="font-black text-sm uppercase tracking-wider">Table of Contents</h2>
              </div>
              <nav className="space-y-1">
                {SECTIONS.map((sec) => {
                  const isActive = activeSection === sec.id;
                  return (
                    <button
                      key={sec.id}
                      onClick={() => scrollToSection(sec.id)}
                      className={`w-full text-left px-3 py-2 rounded text-xs font-bold transition-all flex items-center justify-between ${
                        isActive
                          ? "bg-[#a2ff86] text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                          : "text-zinc-600 hover:text-black hover:bg-zinc-100"
                      }`}
                    >
                      <span className="truncate">{sec.title}</span>
                      {isActive && <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </nav>

              <div className="mt-6 pt-4 border-t-2 border-black bg-[#FAF6EE] -mx-5 -mb-5 p-4 rounded-b-md">
                <p className="text-[11px] font-bold text-zinc-600 uppercase mb-1">Legal Inquiries</p>
                <a
                  href="mailto:vineetsinghk06@gmail.com"
                  className="text-xs font-black text-black hover:underline flex items-center gap-1.5 break-all"
                >
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  vineetsinghk06@gmail.com
                </a>
              </div>
            </div>
          </aside>

          {/* Legal Text Sections */}
          <main className="lg:col-span-8 space-y-10">

            {/* Section 1 */}
            <article id="operator-identity" className="bg-white border-2 border-black rounded-lg p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-[#FFE566] border border-black text-[10px] font-mono font-bold uppercase rounded">Section 1</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black mb-4">
                1. Operator Identity & Legal Status
              </h2>
              <div className="prose prose-zinc max-w-none text-sm text-zinc-700 space-y-3 leading-relaxed">
                <p>
                  The digital service known as <strong>Orbix</strong> (accessible via{" "}
                  <code className="bg-zinc-100 px-1 py-0.5 border border-zinc-300 rounded font-mono">orbix.dev</code> and associated digital subdomains, hereinafter referred to as the <strong>"Platform"</strong> or <strong>"Orbix"</strong>) is an independently operated digital technology platform jointly founded and managed by:
                </p>
                <div className="bg-[#FAF6EE] border-2 border-black rounded p-4 my-3">
                  <p className="font-black text-black uppercase text-xs mb-1">Joint Platform Operators:</p>
                  <ul className="list-disc list-inside font-bold text-zinc-800 space-y-1 text-xs">
                    <li>Rahul Tripathi (Joint Founder & Operator)</li>
                    <li>Vineet Singh Chandel (Joint Founder & Operator)</li>
                  </ul>
                </div>
                <p>
                  Orbix is currently operated in individual capacities as an independent software initiative and is <strong>not incorporated as a company, Limited Liability Partnership (LLP), or registered statutory partnership</strong>. All commitments, privacy assurances, and operational protocols described herein are established directly by the named operators under applicable laws of the Republic of India.
                </p>
                <p>
                  Official correspondence regarding privacy and data protection may be directed to our dedicated grievance inbox at{" "}
                  <a href="mailto:vineetsinghk06@gmail.com" className="font-bold text-black underline">
                    vineetsinghk06@gmail.com
                  </a>
                  , with formal postal correspondence directed to:
                  <br />
                  <span className="font-mono text-xs bg-zinc-100 px-2 py-1 rounded inline-block mt-1 border border-zinc-300">
                    Rahul Tripathi & Vineet Singh Chandel, Attn: Orbix Privacy Desk, [Official Correspondence Address – To Be Confirmed], Kanpur, Uttar Pradesh, India.
                  </span>
                </p>
              </div>
            </article>

            {/* Section 2 */}
            <article id="scope-overview" className="bg-white border-2 border-black rounded-lg p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-[#FFE566] border border-black text-[10px] font-mono font-bold uppercase rounded">Section 2</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black mb-4">
                2. Scope & Applicability
              </h2>
              <div className="prose prose-zinc max-w-none text-sm text-zinc-700 space-y-3 leading-relaxed">
                <p>
                  This Privacy Policy applies to all individuals who access, browse, register, or interact with Orbix, including:
                </p>
                <ul className="list-disc list-inside space-y-1.5 font-medium">
                  <li><strong>Registered Developers:</strong> Individual users establishing unified developer identity and portfolio profiles.</li>
                  <li><strong>Collegiate Chapters & Clubs:</strong> Authorized college representatives and student club leaders operating verified campus chapters.</li>
                  <li><strong>Event Attendees:</strong> Students registering for collegiate hackathons, coding workshops, and campus competitions.</li>
                  <li><strong>Parents & Legal Guardians:</strong> Guardians receiving verification notices and submitting electronic consent for attendees under 18.</li>
                  <li><strong>Public Visitors:</strong> Unauthenticated users browsing developer profiles, college showcases, or technical articles.</li>
                </ul>
              </div>
            </article>

            {/* Section 3 */}
            <article id="information-collected" className="bg-white border-2 border-black rounded-lg p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-[#FFE566] border border-black text-[10px] font-mono font-bold uppercase rounded">Section 3</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black mb-4">
                3. Categories of Information Collected
              </h2>
              <div className="prose prose-zinc max-w-none text-sm text-zinc-700 space-y-4 leading-relaxed">
                <p>
                  Orbix adheres to strict data minimization principles. We collect and process personal data exclusively to provide verifiable developer metrics, authentic college leaderboards, and safe event coordination:
                </p>

                <div className="space-y-3">
                  <div className="border-2 border-black p-3.5 rounded bg-[#FAF6EE]">
                    <h3 className="font-black text-xs uppercase text-black mb-1">A. Account & Identity Information</h3>
                    <p className="text-xs text-zinc-600">
                      Full name, unique username, verified primary email address, encrypted password hash (bcrypt), college affiliation (from our directory of verified institutions), primary mobile phone number (for club representatives and SMS-verified accounts), and avatar photo URL.
                    </p>
                  </div>

                  <div className="border-2 border-black p-3.5 rounded bg-[#FAF6EE]">
                    <h3 className="font-black text-xs uppercase text-black mb-1">B. Connected Coding Platforms & Telemetry</h3>
                    <p className="text-xs text-zinc-600">
                      Public handles and profiles voluntarily connected by the user (e.g., LeetCode, Codeforces, GitHub, CodeChef, HackerRank). We retrieve public statistics including solved problem counts, contest ratings, ranking percentiles, submission streaks, and repository contributions.
                    </p>
                  </div>

                  <div className="border-2 border-black p-3.5 rounded bg-[#FAF6EE]">
                    <h3 className="font-black text-xs uppercase text-black mb-1">C. Career Intelligence & Uploaded Resumes</h3>
                    <p className="text-xs text-zinc-600">
                      Structured resumes created via our editor or uploaded for AST analysis. We extract factual elements (skills, projects, education history) to provide deterministic ATS compatibility scores. Resumes are private by default and never shared publicly without explicit user opt-in.
                    </p>
                  </div>

                  <div className="border-2 border-black p-3.5 rounded bg-[#FAF6EE]">
                    <h3 className="font-black text-xs uppercase text-black mb-1">D. Collegiate Event Registration & Minor Consent Records</h3>
                    <p className="text-xs text-zinc-600">
                      Event applications containing applicant name, academic department, year of study, student roll number, contact phone, and minor declaration. For attendees under 18, we collect parent/guardian name, email, phone number, relationship, and cryptographically verified electronic consent tokens.
                    </p>
                  </div>

                  <div className="border-2 border-black p-3.5 rounded bg-[#FAF6EE]">
                    <h3 className="font-black text-xs uppercase text-black mb-1">E. Security & Device Metadata</h3>
                    <p className="text-xs text-zinc-600">
                      IP addresses, browser user-agent strings, session identifiers, authentication timestamps, and persistent security logs utilized strictly to defend against account takeover, brute-force attacks, and abusive scraping.
                    </p>
                  </div>
                </div>
              </div>
            </article>

            {/* Section 4 */}
            <article id="processing-purposes" className="bg-white border-2 border-black rounded-lg p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-[#FFE566] border border-black text-[10px] font-mono font-bold uppercase rounded">Section 4</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black mb-4">
                4. Purposes & Legal Basis of Processing
              </h2>
              <div className="prose prose-zinc max-w-none text-sm text-zinc-700 space-y-3 leading-relaxed">
                <p>
                  We process personal information under the following legitimate legal bases recognized under Indian data protection law:
                </p>
                <ul className="list-disc list-inside space-y-1.5 font-medium">
                  <li><strong>Contractual Performance:</strong> Providing core Platform services, authenticating access tokens, computing the Orbix Score, and maintaining developer portfolio links.</li>
                  <li><strong>Explicit Consent:</strong> Voluntary connection of third-party coding portals, email/phone OTP verification, and parental/guardian approval for minor attendees.</li>
                  <li><strong>Legitimate Interests:</strong> Preventing fraud, mitigating denial-of-service attempts, preserving platform integrity, and enforcing campus-restricted event boundaries.</li>
                  <li><strong>Legal Compliance:</strong> Maintaining audit records of terms acceptance, data export requests, and compliance with statutory law enforcement directives.</li>
                </ul>
              </div>
            </article>

            {/* Section 5 */}
            <article id="minor-protection" className="bg-white border-2 border-black rounded-lg p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-l-8 border-l-[#FF6B6B]">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-[#FF6B6B] text-white border border-black text-[10px] font-mono font-bold uppercase rounded">Section 5 • Essential Protection</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black mb-4">
                5. Age Eligibility & Minor Attendee Consent Protocol
              </h2>
              <div className="prose prose-zinc max-w-none text-sm text-zinc-700 space-y-3 leading-relaxed">
                <div className="p-4 bg-[#FAF6EE] border-2 border-black rounded font-medium text-xs leading-relaxed">
                  <p className="font-black text-black uppercase mb-1">Strict Individual Account Age Limit:</p>
                  Orbix individual developer accounts are strictly restricted to persons aged <strong>18 years and older</strong>. We enforce this requirement at registration via server-side validation. If we discover an account created by a person under 18 without authority, the account will be immediately terminated.
                </div>

                <h3 className="font-black text-sm uppercase text-black pt-2">Collegiate Events & First-Year Minor Students</h3>
                <p>
                  We recognize that collegiate technical events, hackathons, and symposiums hosted on Orbix frequently admit first-year university students who are 17 years old. To ensure full legal compliance:
                </p>
                <ol className="list-decimal list-inside space-y-2 font-medium">
                  <li><strong>Verifiable Guardian Consent Workflow:</strong> Any event registrant declaring that they are under 18 years old must provide their parent or legal guardian's name, email, phone number, and relationship.</li>
                  <li><strong>Automated Electronic Dispatch:</strong> The Platform automatically transmits a secure, cryptographically generated verification link directly to the guardian's email.</li>
                  <li><strong>Independent Verification Required:</strong> An event organizer's or student's unsupported checkbox declaration is <strong>never</strong> treated as sufficient verification. The parent or guardian must independently open the secure verification link, review the event details, and electronically confirm consent.</li>
                  <li><strong>Strict Coordinator Lock:</strong> Club organizers are technically barred by backend authorization checks from approving or issuing tickets to any minor attendee whose parental consent status remains pending or unverified.</li>
                </ol>
              </div>
            </article>

            {/* Section 6 */}
            <article id="user-content-ownership" className="bg-white border-2 border-black rounded-lg p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-[#FFE566] border border-black text-[10px] font-mono font-bold uppercase rounded">Section 6</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black mb-4">
                6. User Content & Intellectual Property Ownership
              </h2>
              <div className="prose prose-zinc max-w-none text-sm text-zinc-700 space-y-3 leading-relaxed">
                <p>
                  <strong>Users retain full and unencumbered ownership of their content.</strong> You own all text, uploaded resumes, source code references, portfolio links, project writeups, and blog articles you publish or store on Orbix.
                </p>
                <div className="p-4 bg-[#FAF6EE] border-2 border-black rounded space-y-2 text-xs">
                  <p className="font-bold text-black uppercase">Limited Operational License:</p>
                  <p>
                    By uploading or publishing content on Orbix, you grant Orbix and its operators only a limited, revocable, non-exclusive, worldwide, royalty-free license strictly necessary to host, store, cache, format, parse, and display the content to fulfill Platform features.
                  </p>
                  <p className="font-bold text-black uppercase pt-1">Explicit Non-Licensing Prohibitions:</p>
                  <ul className="list-disc list-inside text-zinc-700 space-y-1">
                    <li>Orbix does <strong>NOT</strong> acquire ownership of your personal resumes, source code, or intellectual property.</li>
                    <li>Orbix does <strong>NOT</strong> sell, broker, or license your personal documents to commercial data brokers.</li>
                    <li>Orbix does <strong>NOT</strong> train public generative artificial intelligence or large language models on your private resumes or unpublished project documents.</li>
                  </ul>
                </div>
              </div>
            </article>

            {/* Section 7 */}
            <article id="third-party-processors" className="bg-white border-2 border-black rounded-lg p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-[#FFE566] border border-black text-[10px] font-mono font-bold uppercase rounded">Section 7</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black mb-4">
                7. Data Processors & Sub-processors
              </h2>
              <div className="prose prose-zinc max-w-none text-sm text-zinc-700 space-y-3 leading-relaxed">
                <p>
                  To deliver a resilient, high-speed cloud platform, Orbix contracts with industry-standard cloud infrastructure providers bound by rigorous data protection standards:
                </p>
                <div className="overflow-x-auto border-2 border-black rounded">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-black text-white">
                        <th className="p-2.5 font-black uppercase">Entity / Service</th>
                        <th className="p-2.5 font-black uppercase">Role & Purpose</th>
                        <th className="p-2.5 font-black uppercase">Location / Security</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-black bg-white">
                      <tr>
                        <td className="p-2.5 font-bold">Supabase / PostgreSQL</td>
                        <td className="p-2.5">Primary relational database, credentials, and encrypted records</td>
                        <td className="p-2.5">TLS 1.3 in transit; AES-256 at rest</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold">Upstash Redis</td>
                        <td className="p-2.5">Ephemeral session tokens, rate-limiting counters, and real-time cache</td>
                        <td className="p-2.5">Encrypted in transit; auto-expiring TTLs</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold">Cloudinary</td>
                        <td className="p-2.5">Optimized developer avatar images and collegiate club banners</td>
                        <td className="p-2.5">Secure CDN distribution; retryable purge queue</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold">Resend / SMTP</td>
                        <td className="p-2.5">Transactional verification emails, guardian consent alerts, security notices</td>
                        <td className="p-2.5">Dedicated API relay; zero commercial marketing spam</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </article>

            {/* Section 8 */}
            <article id="security-measures" className="bg-white border-2 border-black rounded-lg p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-[#FFE566] border border-black text-[10px] font-mono font-bold uppercase rounded">Section 8</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black mb-4">
                8. Data Security & Technical Safeguards
              </h2>
              <div className="prose prose-zinc max-w-none text-sm text-zinc-700 space-y-3 leading-relaxed">
                <p>
                  Orbix implements defensive security engineering across all layers of the stack:
                </p>
                <ul className="list-disc list-inside space-y-1.5 font-medium">
                  <li><strong>Cryptographic Password Hashing:</strong> Passwords are never stored in plaintext and are salted and hashed using bcrypt with adaptive work factors.</li>
                  <li><strong>JWT Session Architecture:</strong> Authenticated sessions utilize signed JSON Web Tokens with strict audience and issuer validation, alongside persistent Redis session revocation tables.</li>
                  <li><strong>Dual Email & SMS Verification:</strong> High-trust operations, including club registration and sensitive account updates, require cryptographic token or OTP proof before committing.</li>
                  <li><strong>Rate Limiting & DoS Protection:</strong> IP-level sliding-window rate limiters defend login, registration, and OTP endpoints from brute-force attempts.</li>
                </ul>
              </div>
            </article>

            {/* Section 9 */}
            <article id="retention-deletion" className="bg-white border-2 border-black rounded-lg p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-l-8 border-l-[#a2ff86]">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-[#a2ff86] border border-black text-[10px] font-mono font-bold uppercase rounded">Section 9 • Automated Protocol</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black mb-4">
                9. Data Retention & Seven-Day Deletion Protocol
              </h2>
              <div className="prose prose-zinc max-w-none text-sm text-zinc-700 space-y-3 leading-relaxed">
                <p>
                  We retain personal data only for as long as your account remains active or as strictly necessary to fulfill Platform features.
                </p>

                <div className="bg-[#FAF6EE] border-2 border-black p-4 rounded space-y-2">
                  <h3 className="font-black text-xs uppercase text-black">The Seven-Day Cancellation & Purge Workflow:</h3>
                  <ol className="list-decimal list-inside text-xs text-zinc-800 space-y-1.5 font-medium">
                    <li><strong>Deletion Initiation:</strong> A user requests account erasure directly within the Privacy Center (<code className="bg-white px-1 py-0.5 border border-zinc-300 rounded font-mono">/settings/privacy</code>).</li>
                    <li><strong>Seven-Day Grace Period:</strong> The request enters a mandatory 7-day cancellation window. During these 7 days, the user can cancel the pending request at any time to recover their account.</li>
                    <li><strong>Automated Permanent Purge Worker:</strong> Upon expiration of the 7-day window, our automated background purge worker executes permanent deletion:
                      <ul className="list-disc list-inside pl-4 pt-1 space-y-1 text-zinc-600">
                        <li>All user records in <code className="bg-white px-1 border border-zinc-300 rounded">users</code>, <code className="bg-white px-1 border border-zinc-300 rounded">user_links</code>, and <code className="bg-white px-1 border border-zinc-300 rounded">user_resumes</code> are permanently deleted.</li>
                        <li>Foreign key cascading purges personal notifications, preferences, and session tokens.</li>
                        <li>Remote Cloudinary photo assets are queued for automated cloud destruction.</li>
                        <li>All Redis cache entries (profile, auth, sessions) are immediately evicted.</li>
                        <li>An anonymized SHA-256 cryptographic hash of the email is retained strictly in deletion logs to verify compliance without storing personal identity.</li>
                      </ul>
                    </li>
                  </ol>
                </div>
              </div>
            </article>

            {/* Section 10 */}
            <article id="user-rights" className="bg-white border-2 border-black rounded-lg p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-[#FFE566] border border-black text-[10px] font-mono font-bold uppercase rounded">Section 10</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black mb-4">
                10. User Rights & Privacy Center Controls
              </h2>
              <div className="prose prose-zinc max-w-none text-sm text-zinc-700 space-y-3 leading-relaxed">
                <p>
                  Every registered user has direct self-service controls available in the Orbix Settings Hub:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 border-2 border-black rounded bg-[#FAF6EE]">
                    <p className="font-black text-xs uppercase mb-1">Right to Access & Portability</p>
                    <p className="text-xs text-zinc-600">Download a full JSON archive of your account data, connected handles, scoring milestones, and resume facts.</p>
                  </div>
                  <div className="p-3 border-2 border-black rounded bg-[#FAF6EE]">
                    <p className="font-black text-xs uppercase mb-1">Right to Rectification</p>
                    <p className="text-xs text-zinc-600">Update your verified college, contact phone, display credentials, and profile bio in real-time.</p>
                  </div>
                  <div className="p-3 border-2 border-black rounded bg-[#FAF6EE]">
                    <p className="font-black text-xs uppercase mb-1">Visibility & Incognito Mode</p>
                    <p className="text-xs text-zinc-600">Toggle profile visibility between Public and Private, and mask your Orbix Score from public leaderboards.</p>
                  </div>
                  <div className="p-3 border-2 border-black rounded bg-[#FAF6EE]">
                    <p className="font-black text-xs uppercase mb-1">Right to Erasure</p>
                    <p className="text-xs text-zinc-600">Schedule permanent account deletion with a 7-day safety period and transparent audit history.</p>
                  </div>
                </div>
              </div>
            </article>

            {/* Section 11 */}
            <article id="cookies-tracking" className="bg-white border-2 border-black rounded-lg p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-[#FFE566] border border-black text-[10px] font-mono font-bold uppercase rounded">Section 11</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black mb-4">
                11. Cookies, Telemetry & Local Storage
              </h2>
              <div className="prose prose-zinc max-w-none text-sm text-zinc-700 space-y-3 leading-relaxed">
                <p>
                  Orbix maintains a minimal cookie footprint:
                </p>
                <ul className="list-disc list-inside space-y-1.5 font-medium">
                  <li><strong>Strictly Essential Cookies:</strong> Secure, HTTP-only authentication cookies used to preserve user sessions across page reloads.</li>
                  <li><strong>Local Storage:</strong> Storing client-side UI preferences (such as theme configuration, collapsed sidebar state, and cached leaderboard filters).</li>
                  <li><strong>Zero Third-Party Advertising Trackers:</strong> Orbix does <strong>NOT</strong> embed Meta Pixel, Google AdSense, cross-site retargeting scripts, or third-party behavioral advertising tags.</li>
                </ul>
              </div>
            </article>

            {/* Section 12 */}
            <article id="governing-law" className="bg-white border-2 border-black rounded-lg p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-[#FFE566] border border-black text-[10px] font-mono font-bold uppercase rounded">Section 12</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black mb-4">
                12. Governing Law & Dispute Resolution
              </h2>
              <div className="prose prose-zinc max-w-none text-sm text-zinc-700 space-y-3 leading-relaxed">
                <p>
                  This Privacy Policy and all matters arising out of or related to data processing on Orbix shall be governed by and construed in accordance with the laws of the <strong>Republic of India</strong>, including the Information Technology Act, 2000, and applicable rules thereunder.
                </p>
                <p>
                  Any dispute, controversy, or claim arising out of or relating to this Privacy Policy shall be subject to the exclusive jurisdiction of the competent courts situated at <strong>Kanpur, Uttar Pradesh, India</strong>.
                </p>
              </div>
            </article>

            {/* Section 13 */}
            <article id="amendments" className="bg-white border-2 border-black rounded-lg p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-[#FFE566] border border-black text-[10px] font-mono font-bold uppercase rounded">Section 13</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black mb-4">
                13. Amendments & Version History
              </h2>
              <div className="prose prose-zinc max-w-none text-sm text-zinc-700 space-y-3 leading-relaxed">
                <p>
                  We may revise this Privacy Policy periodically to reflect technological improvements, statutory updates, or new Platform capabilities. Material changes will be accompanied by an prominent in-app notification or banner alert prior to taking effect. Continued use of Orbix following published updates constitutes your agreement to the revised policy.
                </p>
                <div className="bg-[#FAF6EE] border-2 border-black p-3 rounded text-xs font-mono">
                  <p><strong>Current Active Version:</strong> 1.0</p>
                  <p><strong>Effective Date:</strong> November 5, 2026</p>
                  <p><strong>Initial Publication:</strong> November 2026</p>
                </div>
              </div>
            </article>

            {/* Section 14 */}
            <article id="contact-redressal" className="bg-white border-2 border-black rounded-lg p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-[#a2ff86] border border-black text-[10px] font-mono font-bold uppercase rounded">Section 14</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black mb-4">
                14. Grievance Redressal & Contact Information
              </h2>
              <div className="prose prose-zinc max-w-none text-sm text-zinc-700 space-y-3 leading-relaxed">
                <p>
                  If you have inquiries, complaints, or wish to exercise your statutory privacy rights, please contact our designated Grievance Officer:
                </p>
                <div className="bg-[#FAF6EE] border-2 border-black p-4 rounded text-xs space-y-1.5">
                  <p className="font-bold text-black uppercase">Grievance Desk / Joint Platform Operators:</p>
                  <p><strong>Operators:</strong> Rahul Tripathi & Vineet Singh Chandel</p>
                  <p>
                    <strong>Email:</strong>{" "}
                    <a href="mailto:vineetsinghk06@gmail.com" className="font-bold text-black underline">
                      vineetsinghk06@gmail.com
                    </a>
                  </p>
                  <p><strong>Postal Correspondence:</strong> Rahul Tripathi & Vineet Singh Chandel, Attn: Orbix Privacy Desk, [Official Correspondence Address – To Be Confirmed], Kanpur, Uttar Pradesh, India.</p>
                  <p className="text-zinc-600 pt-1">We endeavor to review and resolve all formal privacy inquiries within 30 business days of receipt.</p>
                </div>
              </div>
            </article>

          </main>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
