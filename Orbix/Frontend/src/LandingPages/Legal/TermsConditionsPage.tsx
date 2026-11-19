import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  ArrowLeft,
  Calendar,
  Shield,
  Copy,
  Printer,
  ChevronRight,
  Scale,
  Mail
} from "lucide-react";
import { useToast } from "../../context/ToastContext";

interface Section {
  id: string;
  title: string;
}

const SECTIONS: Section[] = [
  { id: "acceptance-operators", title: "1. Acceptance of Terms & Operator Status" },
  { id: "eligibility-age", title: "2. Eligibility & 18+ Account Restriction" },
  { id: "collegiate-minors", title: "3. Collegiate Chapters & Minor Attendees" },
  { id: "user-accounts", title: "4. User Accounts, Verification & Security" },
  { id: "intellectual-property", title: "5. User Content & Intellectual Property" },
  { id: "acceptable-use", title: "6. Acceptable Use Policy & Prohibited Conduct" },
  { id: "orbix-score", title: "7. Orbix Score & Fair Play Algorithms" },
  { id: "termination-deletion", title: "8. Termination & 7-Day Deletion Protocol" },
  { id: "warranty-disclaimers", title: "9. Disclaimers & 'As Is' Provision" },
  { id: "limitation-liability", title: "10. Limitation of Liability" },
  { id: "indemnification", title: "11. Indemnification" },
  { id: "governing-law", title: "12. Governing Law & Dispute Resolution" },
  { id: "severability-modifications", title: "13. Severability & Amendments" },
  { id: "contact-notices", title: "14. Official Notices & Contact Information" },
];

export const TermsConditionsPage: React.FC = () => {
  const toast = useToast();
  const [activeSection, setActiveSection] = useState<string>("acceptance-operators");

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
    toast.success("Terms & Conditions link copied to clipboard!", { title: "Link Copied" });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#FAF6EE] text-black font-sans antialiased selection:bg-[#FFE566] selection:text-black">
      {/* Top Utility & Brand Bar */}
      <header className="sticky top-0 z-50 bg-[#FAF6EE]/95 backdrop-blur-md border-b-2 border-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 text-sm font-black uppercase tracking-wider px-3 py-1.5 bg-white border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FFE566] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Orbix</span>
            </Link>
            <div className="hidden sm:flex items-center gap-2 font-mono text-xs">
              <span className="font-bold text-zinc-600">LEGAL</span>
              <span className="text-zinc-400">/</span>
              <span className="font-black text-black">TERMS & CONDITIONS</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              title="Copy Page Link"
              className="p-2 bg-white border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#a2ff86] transition-colors"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={handlePrint}
              title="Print Document"
              className="p-2 bg-white border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#a2ff86] transition-colors"
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
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FFE566] border-2 border-black font-black text-xs uppercase tracking-wider rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Scale className="w-3.5 h-3.5" />
              Binding Legal Agreement
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#a2ff86] border-2 border-black font-mono font-bold text-xs rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              Version 1.0
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border-2 border-black font-mono text-xs rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <Calendar className="w-3.5 h-3.5 text-zinc-500" />
              Effective Date: November 2026
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-black uppercase mb-4">
            Orbix Terms & Conditions
          </h1>

          <p className="text-base sm:text-lg text-zinc-700 max-w-3xl leading-relaxed font-medium">
            Please read these Terms & Conditions carefully. They constitute a legally binding agreement between you and
            the Platform operators governing your access to and use of Orbix, developer metrics, collegiate clubs, and
            event systems.
          </p>

          <div className="mt-8 p-4 bg-[#FAF6EE] border-2 border-black rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-[#FFE566] border-2 border-black flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-black" />
              </div>
              <div>
                <p className="font-black text-sm uppercase">Key Legal Commitments</p>
                <p className="text-xs text-zinc-600">
                  Individual accounts restricted to 18+. You retain 100% ownership of your code and resumes. Indian governing law with exclusive Kanpur jurisdiction.
                </p>
              </div>
            </div>
            <Link
              to="/privacy"
              className="text-xs font-black uppercase tracking-wider px-3 py-2 bg-black text-white border-2 border-black rounded hover:bg-zinc-800 transition-colors shrink-0"
            >
              Read Privacy Policy
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
                          ? "bg-[#FFE566] text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
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
                <p className="text-[11px] font-bold text-zinc-600 uppercase mb-1">Legal Queries</p>
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
            <article id="acceptance-operators" className="bg-white border-2 border-black rounded-lg p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-[#FFE566] border border-black text-[10px] font-mono font-bold uppercase rounded">Section 1</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black mb-4">
                1. Acceptance of Terms & Operator Status
              </h2>
              <div className="prose prose-zinc max-w-none text-sm text-zinc-700 space-y-3 leading-relaxed">
                <p>
                  These Terms & Conditions (<strong>"Terms"</strong>) constitute a binding contractual agreement between you (<strong>"User"</strong>, <strong>"you"</strong>, or <strong>"your"</strong>) and the operators of <strong>Orbix</strong> (<strong>"Platform"</strong>, <strong>"we"</strong>, <strong>"us"</strong>, or <strong>"our"</strong>).
                </p>
                <div className="bg-[#FAF6EE] border-2 border-black rounded p-4 my-3">
                  <p className="font-black text-black uppercase text-xs mb-1">Independent Platform Operator Notice:</p>
                  <p className="text-xs text-zinc-700 font-medium">
                    Orbix is an independently operated software platform jointly created and managed by <strong>Rahul Tripathi</strong> and <strong>Vineet Singh Chandel</strong>. Orbix is currently operated in individual capacities and is <strong>not incorporated as a company, Limited Liability Partnership (LLP), or registered statutory partnership</strong>.
                  </p>
                </div>
                <p>
                  By creating an account, clicking "I Agree", linking third-party coding profiles, or using any feature of the Platform, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you do not agree to these Terms, you must not access or use the Platform.
                </p>
              </div>
            </article>

            {/* Section 2 */}
            <article id="eligibility-age" className="bg-white border-2 border-black rounded-lg p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-l-8 border-l-[#FF6B6B]">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-[#FF6B6B] text-white border border-black text-[10px] font-mono font-bold uppercase rounded">Section 2 • Non-Negotiable</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black mb-4">
                2. Eligibility & 18+ Individual Account Restriction
              </h2>
              <div className="prose prose-zinc max-w-none text-sm text-zinc-700 space-y-3 leading-relaxed">
                <div className="p-4 bg-[#FAF6EE] border-2 border-black rounded font-medium text-xs leading-relaxed">
                  <p className="font-black text-black uppercase mb-1">Age 18+ Individual Registration Requirement:</p>
                  Orbix individual developer accounts are strictly restricted to natural persons who are at least <strong>18 years of age</strong> and legally capable of entering into binding contracts under the Indian Contract Act, 1872.
                </div>
                <p>
                  During registration, every applicant must explicitly confirm that they are at least 18 years old. This requirement is verified by server-side validation. Creating an individual account under false age representations constitutes a material breach of these Terms and will result in immediate termination of the account and deletion of associated records.
                </p>
              </div>
            </article>

            {/* Section 3 */}
            <article id="collegiate-minors" className="bg-white border-2 border-black rounded-lg p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-[#FFE566] border border-black text-[10px] font-mono font-bold uppercase rounded">Section 3</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black mb-4">
                3. Collegiate Chapters, Clubs & Minor Attendees
              </h2>
              <div className="prose prose-zinc max-w-none text-sm text-zinc-700 space-y-3 leading-relaxed">
                <p>
                  Orbix facilitates campus community engagement through verified collegiate chapters and student clubs. When conducting technical hackathons, coding workshops, and campus competitions:
                </p>
                <div className="p-4 bg-[#FAF6EE] border-2 border-black rounded space-y-2 text-xs">
                  <p className="font-bold text-black uppercase">Minor Event Attendee Consent Framework:</p>
                  <ul className="list-disc list-inside text-zinc-700 space-y-1.5 font-medium">
                    <li>Collegiate event registrations may accept university attendees under 18 years of age (including 17-year-old first-year students).</li>
                    <li>Organizers must obtain legally required, verifiable electronic consent from the student's parent or legal guardian prior to admitting the student or processing their information.</li>
                    <li>An organizer's or applicant's unsupported checkbox declaration is <strong>never</strong> treated as sufficient verification.</li>
                    <li>The Platform provides an automated guardian verification mechanism transmitting direct electronic authorization requests. Event organizers are technically prevented from issuing tickets or approving applications for minor attendees until parental consent is verified.</li>
                  </ul>
                </div>
              </div>
            </article>

            {/* Section 4 */}
            <article id="user-accounts" className="bg-white border-2 border-black rounded-lg p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-[#FFE566] border border-black text-[10px] font-mono font-bold uppercase rounded">Section 4</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black mb-4">
                4. User Accounts, Verification Proofs & Credentials
              </h2>
              <div className="prose prose-zinc max-w-none text-sm text-zinc-700 space-y-3 leading-relaxed">
                <p>
                  To access Platform capabilities, you must register for an account and provide accurate, current, and complete registration information. You are solely responsible for:
                </p>
                <ul className="list-disc list-inside space-y-1.5 font-medium">
                  <li>Maintaining the confidentiality of your login credentials and password.</li>
                  <li>Completing mandatory email OTP verification to validate primary ownership of your registration email.</li>
                  <li>All activities and submissions that occur under your authenticated account.</li>
                  <li>Notifying us immediately at <a href="mailto:vineetsinghk06@gmail.com" className="font-bold underline">vineetsinghk06@gmail.com</a> upon suspecting any unauthorized breach or account takeover.</li>
                </ul>
              </div>
            </article>

            {/* Section 5 */}
            <article id="intellectual-property" className="bg-white border-2 border-black rounded-lg p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-l-8 border-l-[#a2ff86]">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-[#a2ff86] border border-black text-[10px] font-mono font-bold uppercase rounded">Section 5 • Creator Ownership</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black mb-4">
                5. User Content & Intellectual Property Ownership
              </h2>
              <div className="prose prose-zinc max-w-none text-sm text-zinc-700 space-y-3 leading-relaxed">
                <p>
                  <strong>You retain complete ownership of all content you create, upload, or transmit to Orbix.</strong> This includes your resume text, source code repositories, technical writeups, portfolio links, and personal identity artifacts.
                </p>
                <div className="bg-[#FAF6EE] border-2 border-black p-4 rounded text-xs space-y-2">
                  <p className="font-bold text-black uppercase">Limited Operational License:</p>
                  <p className="text-zinc-700 font-medium leading-relaxed">
                    Solely to operate the Platform and deliver features to you, you grant Orbix and its operators a limited, non-exclusive, worldwide, royalty-free license to host, store, cache, format, parse (including Abstract Syntax Tree fact extraction), and display your content in accordance with your chosen privacy preferences.
                  </p>
                  <p className="font-bold text-black uppercase pt-1">Commercial Non-Exploitation Guarantee:</p>
                  <p className="text-zinc-700 font-medium leading-relaxed">
                    Orbix does <strong>NOT</strong> acquire ownership of your content. We do <strong>NOT</strong> sell your personal resumes to recruiters without your opt-in, broker your code to third parties, or utilize your private documents to train public commercial generative AI models.
                  </p>
                </div>
              </div>
            </article>

            {/* Section 6 */}
            <article id="acceptable-use" className="bg-white border-2 border-black rounded-lg p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-[#FFE566] border border-black text-[10px] font-mono font-bold uppercase rounded">Section 6</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black mb-4">
                6. Acceptable Use Policy & Prohibited Conduct
              </h2>
              <div className="prose prose-zinc max-w-none text-sm text-zinc-700 space-y-3 leading-relaxed">
                <p>
                  You agree to use Orbix exclusively for lawful developer portfolio, collegiate education, and event participation purposes. You agree NOT to:
                </p>
                <ul className="list-disc list-inside space-y-1.5 font-medium">
                  <li>Deploy automated scrapers, bots, crawlers, or harvesting tools against Orbix APIs without prior authorization.</li>
                  <li>Attempt to bypass rate limits, probe private endpoints, exploit security vulnerabilities, or inject malicious payloads.</li>
                  <li>Impersonate any person, college institution, or student club coordinator.</li>
                  <li>Link third-party competitive programming accounts (LeetCode, Codeforces, GitHub) that do not belong to you.</li>
                  <li>Publish unlawful, harassing, defamatory, abusive, or infringing material in public blogs or collegiate discussion forums.</li>
                </ul>
              </div>
            </article>

            {/* Section 7 */}
            <article id="orbix-score" className="bg-white border-2 border-black rounded-lg p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-[#FFE566] border border-black text-[10px] font-mono font-bold uppercase rounded">Section 7</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black mb-4">
                7. Orbix Score & Fair Play Algorithms
              </h2>
              <div className="prose prose-zinc max-w-none text-sm text-zinc-700 space-y-3 leading-relaxed">
                <p>
                  The Orbix Score (ranging deterministically from 0 to 10,000) evaluates verified problem-solving milestones, contest ratings, and development activity across connected platforms.
                </p>
                <div className="p-3.5 border-2 border-black rounded bg-[#FAF6EE] text-xs space-y-1 font-medium">
                  <p className="font-bold text-black uppercase">Algorithmic Integrity & Anti-Gaming:</p>
                  <p className="text-zinc-700">
                    Leaderboards utilize diminishing returns and verified handle synchronization. The Platform operators reserve the right to audit, recalculate, or disqualify accounts found to be artificially inflating ratings through bot submissions, contest plagiarism, or stolen credentials.
                  </p>
                </div>
              </div>
            </article>

            {/* Section 8 */}
            <article id="termination-deletion" className="bg-white border-2 border-black rounded-lg p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-[#FFE566] border border-black text-[10px] font-mono font-bold uppercase rounded">Section 8</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black mb-4">
                8. Account Termination & Seven-Day Deletion Protocol
              </h2>
              <div className="prose prose-zinc max-w-none text-sm text-zinc-700 space-y-3 leading-relaxed">
                <p>
                  You may initiate voluntary account deletion at any time via the Privacy Center. In accordance with our security commitments:
                </p>
                <ol className="list-decimal list-inside text-xs space-y-1.5 font-medium">
                  <li>Upon submission, your account enters a mandatory <strong>seven-day grace period</strong>.</li>
                  <li>During this seven-day period, you may cancel the deletion request at any time by logging in and confirming cancellation.</li>
                  <li>Following the expiration of 7 days, an automated background purge permanently erases your user records, unlinks coding profiles, evicts session caches, and queues cloud image assets for deletion.</li>
                  <li>An anonymized SHA-256 cryptographic hash of the email is retained strictly for statutory compliance auditing without keeping personal identity.</li>
                </ol>
              </div>
            </article>

            {/* Section 9 */}
            <article id="warranty-disclaimers" className="bg-white border-2 border-black rounded-lg p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-[#FFE566] border border-black text-[10px] font-mono font-bold uppercase rounded">Section 9</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black mb-4">
                9. Disclaimers & 'As Is' Provision
              </h2>
              <div className="prose prose-zinc max-w-none text-sm text-zinc-700 space-y-3 leading-relaxed">
                <p className="uppercase text-xs font-bold text-zinc-600">
                  Please read this section carefully, as it limits the legal liability of the platform operators.
                </p>
                <p>
                  THE PLATFORM, INCLUDING ALL METRICS, ANALYTICS, RESUME TOOLS, AND LEADERBOARDS, IS PROVIDED ON AN <strong>"AS IS"</strong> AND <strong>"AS AVAILABLE"</strong> BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMISSIBLE UNDER APPLICABLE LAW, THE OPERATORS EXPRESSLY DISCLAIM ALL WARRANTIES, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
                </p>
                <p>
                  We do not warrant that Platform operations will be uninterrupted, error-free, completely secure, or that third-party coding platform APIs (e.g., LeetCode, Codeforces) will remain available without upstream changes.
                </p>
              </div>
            </article>

            {/* Section 10 */}
            <article id="limitation-liability" className="bg-white border-2 border-black rounded-lg p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-[#FFE566] border border-black text-[10px] font-mono font-bold uppercase rounded">Section 10</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black mb-4">
                10. Limitation of Liability
              </h2>
              <div className="prose prose-zinc max-w-none text-sm text-zinc-700 space-y-3 leading-relaxed">
                <p>
                  TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THE OPERATORS (RAHUL TRIPATHI & VINEET SINGH CHANDEL) BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, USE, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR ACCESS TO OR USE OF (OR INABILITY TO USE) THE PLATFORM.
                </p>
                <p>
                  IN NO EVENT SHALL OUR TOTAL AGGREGATE LIABILITY EXCEED THE GREATER OF ONE THOUSAND INDIAN RUPEES (INR 1,000) OR THE TOTAL AMOUNT PAID BY YOU TO ORBIX IN THE THREE (3) MONTHS PRECEDING THE CLAIM.
                </p>
              </div>
            </article>

            {/* Section 11 */}
            <article id="indemnification" className="bg-white border-2 border-black rounded-lg p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-[#FFE566] border border-black text-[10px] font-mono font-bold uppercase rounded">Section 11</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black mb-4">
                11. Indemnification
              </h2>
              <div className="prose prose-zinc max-w-none text-sm text-zinc-700 space-y-3 leading-relaxed">
                <p>
                  You agree to defend, indemnify, and hold harmless Rahul Tripathi, Vineet Singh Chandel, and any authorized Platform contributors from and against any third-party claims, liabilities, damages, losses, and reasonable legal expenses arising out of or in any way connected with your breach of these Terms, unauthorized submission of a minor's information, or infringement of any intellectual property rights.
                </p>
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
                  These Terms, their interpretation, and any disputes arising out of or related hereto shall be governed exclusively by the laws of the <strong>Republic of India</strong>, without regard to conflict of laws principles.
                </p>
                <p>
                  The parties irrevocably agree that the courts of competent jurisdiction situated at <strong>Kanpur, Uttar Pradesh, India</strong> shall have exclusive jurisdiction over any suit, legal action, or proceeding arising out of or relating to these Terms or the Platform.
                </p>
              </div>
            </article>

            {/* Section 13 */}
            <article id="severability-modifications" className="bg-white border-2 border-black rounded-lg p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-[#FFE566] border border-black text-[10px] font-mono font-bold uppercase rounded">Section 13</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black mb-4">
                13. Severability & Modifications
              </h2>
              <div className="prose prose-zinc max-w-none text-sm text-zinc-700 space-y-3 leading-relaxed">
                <p>
                  If any provision of these Terms is held to be invalid or unenforceable, such provision shall be construed in a manner consistent with applicable law to reflect, as nearly as possible, the original intentions of the parties, and the remaining provisions shall remain in full force and effect.
                </p>
                <p>
                  We reserve the right to modify these Terms at any time. When modifications are made, we will update the Effective Date and provide appropriate notice. Continued use of the Platform after revisions constitutes acceptance of the amended Terms.
                </p>
              </div>
            </article>

            {/* Section 14 */}
            <article id="contact-notices" className="bg-white border-2 border-black rounded-lg p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-[#a2ff86] border border-black text-[10px] font-mono font-bold uppercase rounded">Section 14</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black mb-4">
                14. Official Notices & Contact Information
              </h2>
              <div className="prose prose-zinc max-w-none text-sm text-zinc-700 space-y-3 leading-relaxed">
                <p>
                  All formal notices, legal inquiries, or communications regarding these Terms should be directed to:
                </p>
                <div className="bg-[#FAF6EE] border-2 border-black p-4 rounded text-xs space-y-1.5">
                  <p className="font-bold text-black uppercase">Joint Platform Operators:</p>
                  <p><strong>Operators:</strong> Rahul Tripathi & Vineet Singh Chandel</p>
                  <p>
                    <strong>Email:</strong>{" "}
                    <a href="mailto:vineetsinghk06@gmail.com" className="font-bold text-black underline">
                      vineetsinghk06@gmail.com
                    </a>
                  </p>
                  <p><strong>Postal Address:</strong> Rahul Tripathi & Vineet Singh Chandel, Attn: Legal Desk, [Official Correspondence Address – To Be Confirmed], Kanpur, Uttar Pradesh, India.</p>
                </div>
              </div>
            </article>

          </main>
        </div>
      </div>
    </div>
  );
};

export default TermsConditionsPage;
