export interface PresetBanner {
    id: string;
    title: string;
    category: string;
    themeColor: string;
    accentColor: string;
    badgeText: string;
    svgString: string;
    dataUrl: string;
}

// 1. CYBER HACKATHON / TECH GRID
const CYBER_HACKATHON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="1200" height="675">
  <defs>
    <pattern id="cyber-grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1E293B" stroke-width="1.5"/>
      <circle cx="0" cy="0" r="1.5" fill="#38BDF8" opacity="0.6"/>
    </pattern>
    <radialGradient id="cyber-glow" cx="80%" cy="30%" r="60%">
      <stop offset="0%" stop-color="#0284C7" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#0B0F19" stop-opacity="1"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="675" fill="#090D16"/>
  <rect width="1200" height="675" fill="url(#cyber-glow)"/>
  <rect width="1200" height="675" fill="url(#cyber-grid)" opacity="0.85"/>

  <!-- Matrix circuit traces -->
  <path d="M 0 180 L 320 180 L 400 260 L 750 260 L 820 190 L 1200 190" fill="none" stroke="#A2FF86" stroke-width="2.5" stroke-dasharray="8 6" opacity="0.6"/>
  <path d="M 120 675 L 260 535 L 560 535 L 640 615 L 1200 615" fill="none" stroke="#38BDF8" stroke-width="2" opacity="0.5"/>
  <circle cx="400" cy="260" r="6" fill="#A2FF86"/>
  <circle cx="820" cy="190" r="6" fill="#38BDF8"/>
  <circle cx="260" cy="535" r="5" fill="#38BDF8"/>

  <!-- Neo-Brutalist Isometric Terminal Card -->
  <g transform="translate(680, 160)">
    <!-- Shadow -->
    <rect x="12" y="12" width="440" height="340" rx="20" fill="#000000"/>
    <!-- Card Frame -->
    <rect x="0" y="0" width="440" height="340" rx="20" fill="#0F172A" stroke="#A2FF86" stroke-width="3.5"/>
    <!-- Terminal Header -->
    <rect x="0" y="0" width="440" height="48" rx="20" fill="#1E293B"/>
    <rect x="0" y="24" width="440" height="24" fill="#1E293B"/>
    <circle cx="28" cy="24" r="6" fill="#EF4444"/>
    <circle cx="48" cy="24" r="6" fill="#F59E0B"/>
    <circle cx="68" cy="24" r="6" fill="#10B981"/>
    <text x="96" y="29" fill="#94A3B8" font-family="monospace" font-size="12" font-weight="bold">terminal://orbix.dev/hackathon</text>

    <!-- Code Content -->
    <text x="32" y="90" fill="#A2FF86" font-family="monospace" font-size="15" font-weight="bold">> git clone orbix://event/sprint</text>
    <text x="32" y="120" fill="#E2E8F0" font-family="monospace" font-size="13">> Initializing environment...</text>
    <text x="32" y="145" fill="#38BDF8" font-family="monospace" font-size="13">✓ Neural Engine Linked [200 OK]</text>
    <text x="32" y="170" fill="#38BDF8" font-family="monospace" font-size="13">✓ Verified Student Pass Armed</text>
    <text x="32" y="200" fill="#FACC15" font-family="monospace" font-size="14" font-weight="bold">STAGE: 36h Code Sprint Active</text>

    <!-- Mini Progress Bars -->
    <rect x="32" y="230" width="376" height="14" rx="7" fill="#1E293B" stroke="#334155"/>
    <rect x="32" y="230" width="280" height="14" rx="7" fill="#A2FF86"/>

    <!-- Terminal Footer Badge -->
    <rect x="32" y="270" width="160" height="36" rx="10" fill="#A2FF86"/>
    <text x="50" y="293" fill="#000000" font-family="sans-serif" font-size="12" font-weight="900">RUN HACKATHON</text>
  </g>

  <!-- Left Content Info and Badges -->
  <g transform="translate(80, 140)">
    <!-- Category Pill -->
    <g>
      <rect x="4" y="4" width="230" height="44" rx="14" fill="#000000"/>
      <rect x="0" y="0" width="230" height="44" rx="14" fill="#A2FF86" stroke="#000000" stroke-width="2.5"/>
      <text x="22" y="28" fill="#000000" font-family="sans-serif" font-size="14" font-weight="900" letter-spacing="1">⚡ HACK SPRINT '26</text>
    </g>

    <!-- Main Title -->
    <text x="0" y="130" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="64" font-weight="900" letter-spacing="-1.5">
      BUILD THE
    </text>
    <text x="0" y="205" fill="#A2FF86" font-family="system-ui, -apple-system, sans-serif" font-size="68" font-weight="900" letter-spacing="-1.5">
      FUTURE_
    </text>

    <!-- Tagline -->
    <text x="0" y="260" fill="#94A3B8" font-family="sans-serif" font-size="20" font-weight="700">
      COLLABORATE. CODE. INNOVATE. DEPLOY.
    </text>

    <!-- Tech Badges -->
    <g transform="translate(0, 310)">
      <rect x="0" y="0" width="105" height="34" rx="10" fill="#1E293B" stroke="#38BDF8" stroke-width="2"/>
      <text x="14" y="22" fill="#38BDF8" font-family="monospace" font-size="12" font-weight="bold">#Web3</text>

      <rect x="115" y="0" width="95" height="34" rx="10" fill="#1E293B" stroke="#A2FF86" stroke-width="2"/>
      <text x="130" y="22" fill="#A2FF86" font-family="monospace" font-size="12" font-weight="bold">#AI/ML</text>

      <rect x="220" y="0" width="105" height="34" rx="10" fill="#1E293B" stroke="#F43F5E" stroke-width="2"/>
      <text x="234" y="22" fill="#F43F5E" font-family="monospace" font-size="12" font-weight="bold">#FullStack</text>
    </g>
  </g>

  <!-- Bottom Brand Ribbon -->
  <rect x="0" y="625" width="1200" height="50" fill="#000000"/>
  <line x1="0" y1="625" x2="1200" y2="625" stroke="#A2FF86" stroke-width="3"/>
  <text x="80" y="656" fill="#A2FF86" font-family="monospace" font-size="13" font-weight="bold">ORBIX CAMPUS HACKATHON // OFFICIAL DEVELOPER ECOSYSTEM</text>
  <text x="1060" y="656" fill="#94A3B8" font-family="monospace" font-size="13" font-weight="bold">01001111</text>
</svg>`;

// 2. DEV WORKSHOP / BLUEPRINT LAB
const DEV_WORKSHOP_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="1200" height="675">
  <defs>
    <pattern id="blueprint-grid" width="30" height="30" patternUnits="userSpaceOnUse">
      <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#2563EB" stroke-width="1" opacity="0.45"/>
    </pattern>
  </defs>

  <!-- Background Blueprint Blue -->
  <rect width="1200" height="675" fill="#1E3A8A"/>
  <rect width="1200" height="675" fill="url(#blueprint-grid)"/>

  <!-- Blueprint Ticks and Crosshairs -->
  <circle cx="100" cy="100" r="28" fill="none" stroke="#60A5FA" stroke-width="2" stroke-dasharray="4 4"/>
  <line x1="100" y1="60" x2="100" y2="140" stroke="#60A5FA" stroke-width="1.5"/>
  <line x1="60" y1="100" x2="140" y2="100" stroke="#60A5FA" stroke-width="1.5"/>

  <circle cx="1100" cy="550" r="36" fill="none" stroke="#FDE047" stroke-width="2" stroke-dasharray="6 4"/>
  <line x1="1100" y1="500" x2="1100" y2="600" stroke="#FDE047" stroke-width="2"/>
  <line x1="1050" y1="550" x2="1150" y2="550" stroke="#FDE047" stroke-width="2"/>

  <!-- Big Stylized Isometric Lab Stack -->
  <g transform="translate(740, 150)">
    <!-- Shadow Box -->
    <rect x="14" y="14" width="380" height="360" rx="24" fill="#0F172A"/>
    <!-- Brutalist Card Box -->
    <rect x="0" y="0" width="380" height="360" rx="24" fill="#FAF6EE" stroke="#000000" stroke-width="4"/>

    <!-- Header bar -->
    <rect x="0" y="0" width="380" height="60" rx="24" fill="#FFE566" stroke="#000000" stroke-width="4"/>
    <rect x="0" y="40" width="380" height="20" fill="#FFE566"/>
    <text x="30" y="38" fill="#000000" font-family="sans-serif" font-size="16" font-weight="900" letter-spacing="1">DEV LABS // WORKSHOP</text>

    <!-- Lab Blueprint graphic -->
    <g transform="translate(35, 90)">
      <rect x="0" y="0" width="310" height="75" rx="12" fill="#FFFFFF" stroke="#000000" stroke-width="2.5"/>
      <text x="20" y="32" fill="#000000" font-family="monospace" font-size="13" font-weight="bold">MODULE 01</text>
      <text x="20" y="55" fill="#2563EB" font-family="sans-serif" font-size="16" font-weight="900">Architecture &amp; Patterns</text>

      <rect x="0" y="90" width="310" height="75" rx="12" fill="#FFFFFF" stroke="#000000" stroke-width="2.5"/>
      <text x="20" y="122" fill="#000000" font-family="monospace" font-size="13" font-weight="bold">MODULE 02</text>
      <text x="20" y="145" fill="#10B981" font-family="sans-serif" font-size="16" font-weight="900">Hands-on Live Coding</text>

      <rect x="0" y="180" width="310" height="50" rx="12" fill="#000000"/>
      <text x="75" y="211" fill="#FFE566" font-family="sans-serif" font-size="14" font-weight="900">BUILD &amp; DEPLOY NOW</text>
    </g>
  </g>

  <!-- Left Content -->
  <g transform="translate(80, 160)">
    <!-- Badge -->
    <g>
      <rect x="4" y="4" width="220" height="42" rx="12" fill="#000000"/>
      <rect x="0" y="0" width="220" height="42" rx="12" fill="#FFE566" stroke="#000000" stroke-width="2.5"/>
      <text x="20" y="27" fill="#000000" font-family="sans-serif" font-size="14" font-weight="900" letter-spacing="1">🛠️ HANDS-ON WORKSHOP</text>
    </g>

    <text x="0" y="125" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="62" font-weight="900" letter-spacing="-1.5">
      DEVELOPER
    </text>
    <text x="0" y="195" fill="#FFE566" font-family="system-ui, -apple-system, sans-serif" font-size="66" font-weight="900" letter-spacing="-1.5">
      BOOTCAMP.
    </text>

    <text x="0" y="250" fill="#BFDBFE" font-family="sans-serif" font-size="20" font-weight="700">
      LEARN FROM SCRATCH. BUILD LIVE PROJECTS.
    </text>

    <!-- Feature tags -->
    <g transform="translate(0, 290)">
      <rect x="0" y="0" width="130" height="38" rx="10" fill="#3B82F6" stroke="#FFFFFF" stroke-width="2"/>
      <text x="16" y="24" fill="#FFFFFF" font-family="sans-serif" font-size="13" font-weight="800">100% Practical</text>

      <rect x="145" y="0" width="145" height="38" rx="10" fill="#10B981" stroke="#000000" stroke-width="2"/>
      <text x="16" y="24" transform="translate(145,0)" fill="#000000" font-family="sans-serif" font-size="13" font-weight="800">Certified Skills</text>
    </g>
  </g>

  <!-- Footer Blueprint Strip -->
  <rect x="0" y="625" width="1200" height="50" fill="#0F172A"/>
  <line x1="0" y1="625" x2="1200" y2="625" stroke="#60A5FA" stroke-width="3"/>
  <text x="80" y="656" fill="#93C5FD" font-family="monospace" font-size="13" font-weight="bold">ORBIX CAMPUS MASTERCLASS // BRUTALIST TECHNICAL SERIES</text>
</svg>`;

// 3. CAMPUS KEYNOTE / TECH SUMMIT
const CAMPUS_KEYNOTE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="1200" height="675">
  <defs>
    <pattern id="dots-pattern" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="4" cy="4" r="2.5" fill="#000000" opacity="0.12"/>
    </pattern>
  </defs>

  <!-- Bold Neo-Brutalist Sunflower Background -->
  <rect width="1200" height="675" fill="#FFE566"/>
  <rect width="1200" height="675" fill="url(#dots-pattern)"/>

  <!-- Massive Brutalist 8-Point Starburst Background Accent -->
  <g transform="translate(920, 290) rotate(15)">
    <polygon points="0,-160 45,-45 160,0 45,45 0,160 -45,45 -160,0 -45,-45" fill="#8B5CF6" stroke="#000000" stroke-width="4"/>
    <circle cx="0" cy="0" r="60" fill="#000000"/>
    <polygon points="0,-40 10,-10 40,0 10,10 0,40 -10,10 -40,0 -10,-10" fill="#FFE566"/>
  </g>

  <!-- Floating Ticket / Pass Preview Card -->
  <g transform="translate(680, 160)">
    <rect x="14" y="14" width="420" height="340" rx="24" fill="#000000"/>
    <rect x="0" y="0" width="420" height="340" rx="24" fill="#FFFFFF" stroke="#000000" stroke-width="4"/>

    <!-- Keynote Banner Card Content -->
    <rect x="24" y="24" width="372" height="130" rx="16" fill="#8B5CF6" stroke="#000000" stroke-width="3"/>
    <text x="44" y="65" fill="#FFE566" font-family="sans-serif" font-size="14" font-weight="900" letter-spacing="1.5">SPECIAL GUEST KEYNOTE</text>
    <text x="44" y="105" fill="#FFFFFF" font-family="sans-serif" font-size="28" font-weight="900">LEADERSHIP &amp; TECH</text>
    <text x="44" y="132" fill="#E9D5FF" font-family="sans-serif" font-size="13" font-weight="bold">Auditorium Main Stage • Live &amp; Interactive</text>

    <!-- Details Box -->
    <rect x="24" y="174" width="372" height="85" rx="16" fill="#FAF6EE" stroke="#000000" stroke-width="2.5"/>
    <text x="44" y="208" fill="#52525B" font-family="sans-serif" font-size="12" font-weight="900">EXCLUSIVE ENTRY</text>
    <text x="44" y="235" fill="#000000" font-family="sans-serif" font-size="16" font-weight="900">Orbix Verified QR Pass Required</text>

    <!-- Bottom Punch-Out Bar -->
    <rect x="24" y="278" width="372" height="40" rx="10" fill="#000000"/>
    <text x="135" y="303" fill="#FFE566" font-family="sans-serif" font-size="13" font-weight="900">RESERVE SEAT TODAY</text>
  </g>

  <!-- Left Content Info -->
  <g transform="translate(80, 140)">
    <!-- Category Badge -->
    <g>
      <rect x="4" y="4" width="220" height="44" rx="12" fill="#000000"/>
      <rect x="0" y="0" width="220" height="44" rx="12" fill="#FFFFFF" stroke="#000000" stroke-width="3"/>
      <text x="20" y="28" fill="#000000" font-family="sans-serif" font-size="14" font-weight="900" letter-spacing="1">🎙️ KEYNOTE &amp; SUMMIT</text>
    </g>

    <text x="0" y="135" fill="#000000" font-family="system-ui, -apple-system, sans-serif" font-size="64" font-weight="900" letter-spacing="-1.5">
      CAMPUS TECH
    </text>
    <text x="0" y="210" fill="#8B5CF6" font-family="system-ui, -apple-system, sans-serif" font-size="68" font-weight="900" letter-spacing="-1.5">
      SUMMIT '26.
    </text>

    <text x="0" y="265" fill="#27272A" font-family="sans-serif" font-size="21" font-weight="700">
      INDUSTRY LEADERS. REAL STORIES. INSPIRING MINDS.
    </text>

    <!-- Details pills -->
    <g transform="translate(0, 310)">
      <rect x="0" y="0" width="130" height="40" rx="12" fill="#000000"/>
      <text x="18" y="25" fill="#FFE566" font-family="sans-serif" font-size="13" font-weight="900">Open to All</text>

      <rect x="145" y="0" width="150" height="40" rx="12" fill="#A2FF86" stroke="#000000" stroke-width="2.5"/>
      <text x="16" y="25" transform="translate(145,0)" fill="#000000" font-family="sans-serif" font-size="13" font-weight="900">Networking RSVP</text>
    </g>
  </g>

  <!-- Bottom Strip -->
  <rect x="0" y="625" width="1200" height="50" fill="#000000"/>
  <line x1="0" y1="625" x2="1200" y2="625" stroke="#FFE566" stroke-width="3"/>
  <text x="80" y="656" fill="#FFE566" font-family="monospace" font-size="13" font-weight="bold">ORBIX THOUGHT LEADERSHIP SERIES // CAMPUS AUDITORIUM</text>
</svg>`;

// 4. AI & NEURAL INNOVATION / DATA VAULT
const AI_NEURAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="1200" height="675">
  <defs>
    <radialGradient id="ai-glow" cx="70%" cy="40%" r="55%">
      <stop offset="0%" stop-color="#F43F5E" stop-opacity="0.4"/>
      <stop offset="60%" stop-color="#4C1D95" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#18042B" stop-opacity="1"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="675" fill="#150226"/>
  <rect width="1200" height="675" fill="url(#ai-glow)"/>

  <!-- Neural Constellation Lines and Nodes -->
  <g stroke="#F43F5E" stroke-width="1.5" opacity="0.45">
    <line x1="750" y1="180" x2="880" y2="120"/>
    <line x1="880" y1="120" x2="1040" y2="190"/>
    <line x1="1040" y1="190" x2="980" y2="340"/>
    <line x1="980" y1="340" x2="830" y2="390"/>
    <line x1="830" y1="390" x2="750" y2="180"/>
    <line x1="880" y1="120" x2="980" y2="340"/>
    <line x1="750" y1="180" x2="1040" y2="190"/>
  </g>
  <circle cx="750" cy="180" r="7" fill="#F43F5E"/>
  <circle cx="880" cy="120" r="9" fill="#A78BFA"/>
  <circle cx="1040" cy="190" r="8" fill="#6EE7B7"/>
  <circle cx="980" cy="340" r="10" fill="#F43F5E"/>
  <circle cx="830" cy="390" r="7" fill="#6EE7B7"/>

  <!-- Isometric Brain / Neural Card -->
  <g transform="translate(700, 160)">
    <rect x="12" y="12" width="420" height="340" rx="20" fill="#000000"/>
    <rect x="0" y="0" width="420" height="340" rx="20" fill="#200B3B" stroke="#F43F5E" stroke-width="3.5"/>

    <rect x="0" y="0" width="420" height="50" rx="20" fill="#3B1266"/>
    <text x="30" y="32" fill="#F43F5E" font-family="monospace" font-size="14" font-weight="bold">NEURAL_CORE // LLM_AGENT.py</text>

    <text x="30" y="95" fill="#E2E8F0" font-family="monospace" font-size="14">import torch.nn as nn</text>
    <text x="30" y="125" fill="#A78BFA" font-family="monospace" font-size="14">class VisionAgent(nn.Module):</text>
    <text x="50" y="155" fill="#6EE7B7" font-family="monospace" font-size="13">def __init__(self, latent=512):</text>
    <text x="70" y="185" fill="#F43F5E" font-family="monospace" font-size="13">self.transformer = Transformer()</text>
    <text x="50" y="215" fill="#FDE047" font-family="monospace" font-size="13"># Status: Accuracy 98.4% [CONVERGED]</text>

    <!-- Graphic Progress -->
    <rect x="30" y="245" width="360" height="12" rx="6" fill="#150226"/>
    <rect x="30" y="245" width="310" height="12" rx="6" fill="#F43F5E"/>

    <rect x="30" y="280" width="360" height="36" rx="10" fill="#6EE7B7"/>
    <text x="130" y="303" fill="#000000" font-family="sans-serif" font-size="13" font-weight="900">RUN LIVE INFERENCE</text>
  </g>

  <!-- Left Info -->
  <g transform="translate(80, 140)">
    <g>
      <rect x="4" y="4" width="230" height="44" rx="12" fill="#000000"/>
      <rect x="0" y="0" width="230" height="44" rx="12" fill="#F43F5E" stroke="#000000" stroke-width="2.5"/>
      <text x="20" y="28" fill="#FFFFFF" font-family="sans-serif" font-size="14" font-weight="900" letter-spacing="1">🧠 AI &amp; DATA LAB</text>
    </g>

    <text x="0" y="130" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="64" font-weight="900" letter-spacing="-1.5">
      INTELLIGENCE
    </text>
    <text x="0" y="205" fill="#F43F5E" font-family="system-ui, -apple-system, sans-serif" font-size="68" font-weight="900" letter-spacing="-1.5">
      HORIZONS.
    </text>

    <text x="0" y="260" fill="#D8B4FE" font-family="sans-serif" font-size="20" font-weight="700">
      DEEP LEARNING. LARGE MODELS. REAL IMPACT.
    </text>

    <g transform="translate(0, 310)">
      <rect x="0" y="0" width="115" height="36" rx="10" fill="#3B1266" stroke="#A78BFA" stroke-width="2"/>
      <text x="14" y="23" fill="#A78BFA" font-family="monospace" font-size="12" font-weight="bold">#PyTorch</text>

      <rect x="125" y="0" width="110" height="36" rx="10" fill="#3B1266" stroke="#6EE7B7" stroke-width="2"/>
      <text x="138" y="23" fill="#6EE7B7" font-family="monospace" font-size="12" font-weight="bold">#OpenAI</text>
    </g>
  </g>

  <rect x="0" y="625" width="1200" height="50" fill="#0A0114"/>
  <line x1="0" y1="625" x2="1200" y2="625" stroke="#F43F5E" stroke-width="3"/>
  <text x="80" y="656" fill="#F43F5E" font-family="monospace" font-size="13" font-weight="bold">ORBIX APPLIED ARTIFICIAL INTELLIGENCE // RESEARCH &amp; DEPLOY</text>
</svg>`;

// 5. CODE & COFFEE / CREATIVE JAM
const CODE_COFFEE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="1200" height="675">
  <defs>
    <pattern id="jam-dots" width="28" height="28" patternUnits="userSpaceOnUse">
      <circle cx="5" cy="5" r="2" fill="#C2410C" opacity="0.2"/>
    </pattern>
  </defs>

  <rect width="1200" height="675" fill="#FFF7ED"/>
  <rect width="1200" height="675" fill="url(#jam-dots)"/>

  <!-- Steaming Coffee Cup Graphic on Right -->
  <g transform="translate(740, 160)">
    <rect x="14" y="14" width="380" height="340" rx="24" fill="#000000"/>
    <rect x="0" y="0" width="380" height="340" rx="24" fill="#FFFFFF" stroke="#000000" stroke-width="4"/>

    <!-- Coffee Header -->
    <rect x="0" y="0" width="380" height="55" rx="24" fill="#FB923C" stroke="#000000" stroke-width="4"/>
    <rect x="0" y="35" width="380" height="20" fill="#FB923C"/>
    <text x="30" y="35" fill="#000000" font-family="sans-serif" font-size="15" font-weight="900" letter-spacing="1">☕ BUILD &amp; CONNECT</text>

    <!-- Coffee Cup Vector Art -->
    <g transform="translate(130, 95)">
      <!-- Steam -->
      <path d="M 30 10 Q 40 0, 30 -10 Q 20 -20, 30 -30" fill="none" stroke="#EA580C" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M 55 10 Q 65 0, 55 -10 Q 45 -20, 55 -30" fill="none" stroke="#EA580C" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M 80 10 Q 90 0, 80 -10 Q 70 -20, 80 -30" fill="none" stroke="#EA580C" stroke-width="3.5" stroke-linecap="round"/>
      <!-- Cup Body -->
      <rect x="15" y="25" width="85" height="75" rx="14" fill="#EA580C" stroke="#000000" stroke-width="3"/>
      <!-- Cup Handle -->
      <path d="M 100 40 Q 125 40, 125 60 Q 125 80, 100 80" fill="none" stroke="#000000" stroke-width="4" stroke-linecap="round"/>
      <!-- Saucer -->
      <rect x="0" y="105" width="115" height="12" rx="6" fill="#000000"/>
    </g>

    <!-- Community Details -->
    <rect x="25" y="235" width="330" height="70" rx="14" fill="#FFF7ED" stroke="#000000" stroke-width="2.5"/>
    <text x="45" y="262" fill="#000000" font-family="sans-serif" font-size="14" font-weight="900">CASUAL HACKING &amp; NETWORKING</text>
    <text x="45" y="285" fill="#EA580C" font-family="sans-serif" font-size="12" font-weight="bold">Bring your laptop • Good vibes provided</text>
  </g>

  <!-- Left Info -->
  <g transform="translate(80, 140)">
    <g>
      <rect x="4" y="4" width="220" height="44" rx="12" fill="#000000"/>
      <rect x="0" y="0" width="220" height="44" rx="12" fill="#FB923C" stroke="#000000" stroke-width="3"/>
      <text x="20" y="28" fill="#000000" font-family="sans-serif" font-size="14" font-weight="900" letter-spacing="1">☕ CREATIVE JAM</text>
    </g>

    <text x="0" y="130" fill="#0F172A" font-family="system-ui, -apple-system, sans-serif" font-size="64" font-weight="900" letter-spacing="-1.5">
      CODE &amp; COFFEE
    </text>
    <text x="0" y="205" fill="#EA580C" font-family="system-ui, -apple-system, sans-serif" font-size="68" font-weight="900" letter-spacing="-1.5">
      MEETUP_
    </text>

    <text x="0" y="260" fill="#475569" font-family="sans-serif" font-size="20" font-weight="700">
      CONNECT WITH BUILDERS. WORK ON PASSION PROJECTS.
    </text>

    <g transform="translate(0, 310)">
      <rect x="0" y="0" width="140" height="40" rx="12" fill="#14B8A6" stroke="#000000" stroke-width="2.5"/>
      <text x="20" y="25" fill="#000000" font-family="sans-serif" font-size="13" font-weight="900">All Levels Welcome</text>

      <rect x="155" y="0" width="130" height="40" rx="12" fill="#000000"/>
      <text x="18" y="25" transform="translate(155,0)" fill="#FFF7ED" font-family="sans-serif" font-size="13" font-weight="900">Weekly Hangout</text>
    </g>
  </g>

  <!-- Bottom Strip -->
  <rect x="0" y="625" width="1200" height="50" fill="#000000"/>
  <line x1="0" y1="625" x2="1200" y2="625" stroke="#FB923C" stroke-width="3"/>
  <text x="80" y="656" fill="#FB923C" font-family="monospace" font-size="13" font-weight="bold">ORBIX COMMUNITY BUILDERS // CAMPUS DEVELOPER CIRCLE</text>
</svg>`;

const toDataUrl = (svg: string): string => {
    const cleanSvg = svg.replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;");
    try {
        if (typeof window !== "undefined" && typeof window.btoa === "function") {
            const base64 = window.btoa(unescape(encodeURIComponent(cleanSvg)));
            return `data:image/svg+xml;base64,${base64}`;
        }
    } catch {
        // Fallback to encoded UTF-8 URI
    }
    return `data:image/svg+xml;utf8,${encodeURIComponent(cleanSvg)}`;
};

export const PRESET_EVENT_BANNERS: PresetBanner[] = [
    {
        id: "cyber-hackathon",
        title: "Cyber Matrix Sprint",
        category: "Hackathon & Code Sprint",
        themeColor: "#090D16",
        accentColor: "#A2FF86",
        badgeText: "⚡ HACK SPRINT",
        svgString: CYBER_HACKATHON_SVG,
        dataUrl: toDataUrl(CYBER_HACKATHON_SVG),
    },
    {
        id: "dev-workshop",
        title: "Blueprint Bootcamp",
        category: "Hands-on Workshop",
        themeColor: "#1E3A8A",
        accentColor: "#FFE566",
        badgeText: "🛠️ DEV WORKSHOP",
        svgString: DEV_WORKSHOP_SVG,
        dataUrl: toDataUrl(DEV_WORKSHOP_SVG),
    },
    {
        id: "campus-keynote",
        title: "Campus Tech Summit",
        category: "Keynote & Speaker Session",
        themeColor: "#FFE566",
        accentColor: "#8B5CF6",
        badgeText: "🎙️ KEYNOTE SUMMIT",
        svgString: CAMPUS_KEYNOTE_SVG,
        dataUrl: toDataUrl(CAMPUS_KEYNOTE_SVG),
    },
    {
        id: "ai-neural-lab",
        title: "Neural Intelligence",
        category: "AI & Machine Learning",
        themeColor: "#150226",
        accentColor: "#F43F5E",
        badgeText: "🧠 AI LAB",
        svgString: AI_NEURAL_SVG,
        dataUrl: toDataUrl(AI_NEURAL_SVG),
    },
    {
        id: "code-and-coffee",
        title: "Code & Coffee Jam",
        category: "Developer Jam & Meetup",
        themeColor: "#FFF7ED",
        accentColor: "#FB923C",
        badgeText: "☕ CREATIVE JAM",
        svgString: CODE_COFFEE_SVG,
        dataUrl: toDataUrl(CODE_COFFEE_SVG),
    },
];

export function getRandomPresetBanner(): PresetBanner {
    const idx = Math.floor(Math.random() * PRESET_EVENT_BANNERS.length);
    return PRESET_EVENT_BANNERS[idx];
}
