#!/usr/bin/env python3
"""Inventory contact literals and credential candidates without reproducing secrets."""
from pathlib import Path
import subprocess
import re

ROOT = Path(__file__).resolve().parents[1]
files = subprocess.check_output(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd=ROOT).decode().split('\0')
email = re.compile(r'(?<![\w.])([A-Za-z0-9_.%+\-]+)@([A-Za-z0-9.\-]+\.[A-Za-z]{2,})(?![\w.])')
phone = re.compile(r'''(?<=["'`])(?:\+91[ -]?)?[6-9]\d{9}(?=["'`])''')
credential = re.compile(r'AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{30,}|sk_live_[A-Za-z0-9]{20,}|re_[A-Za-z0-9]{25,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')
literal = re.compile(r'''(?i)\b(password|jwt_secret|api_secret|api_key|client_secret|access_token|auth_token|private_key)\s*[:=]\s*["']([^"'\n]{6,})["']''')
contacts, candidates, scanned = [], [], 0
for name in files:
    p = ROOT / name
    if not p.is_file() or p.suffix.lower() not in {'.ts','.tsx','.js','.jsx','.mjs','.cjs','.json','.sql','.md','.txt','.html','.yml','.yaml','.py','.example'}: continue
    if any(x in name for x in ['lock.json', 'pnpm-lock', 'docs/security-', 'scripts/audit-public-data.py']): continue
    try: content = p.read_text()
    except (UnicodeError, OSError): continue
    scanned += 1
    for line_no, line in enumerate(content.splitlines(), 1):
        for m in email.finditer(line):
            contacts.append((name, line_no, 'Email', m[1][:1]+'***@'+m[2]))
        for m in phone.finditer(line):
            digits = re.sub(r'\D', '', m[0])
            contacts.append((name, line_no, 'Phone', digits[:2]+'*'*(len(digits)-4)+digits[-2:]))
        if credential.search(line): candidates.append((name,line_no,'Provider key/private key candidate; value omitted'))
        for m in literal.finditer(line):
            candidates.append((name,line_no,f'{m[1]} literal; value omitted (may be fixture/placeholder)'))
env_keys = []
for base in [ROOT, ROOT/'Backend', ROOT/'Frontend']:
    for p in base.glob('.env*'):
        if not p.is_file(): continue
        for n, line in enumerate(p.read_text().splitlines(),1):
            m = re.match(r'\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)',line)
            if m and re.search(r'SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE_KEY|DATABASE_URL|DB_URL',m[1]):
                env_keys.append((str(p.relative_to(ROOT)),n,m[1],'non-empty' if m[2].strip().strip('\"\'') else 'empty'))
report = ['# Contact and credential inventory', '', 'Generated from the current working tree, including untracked source files. Values are masked or omitted. This is a static inventory, not proof that a value is live or publicly served.', '', f'Scanned {scanned} source/configuration text files; {len(contacts)} contact occurrences; {len(candidates)} credential candidates.', '', '## Email and phone literals', '', '| File | Line | Type | Masked value |', '|---|---:|---|---|']
report += [f'| `{p}` | {n} | {kind} | `{value}` |' for p,n,kind,value in contacts]
report += ['', '## Credential literal candidates', '', 'Fixtures, example credentials, and regular expressions can appear here. Never copy a real value into a public issue.', '', '| File | Line | Finding |', '|---|---:|---|']
report += [f'| `{p}` | {n} | {kind} |' for p,n,kind in candidates]
report += ['', '## Environment credential configuration', '', 'Only variable names and presence are recorded; credentials are never printed. A non-empty placeholder is not a configured production integration.', '', '| File | Line | Variable | Presence |', '|---|---:|---|---|']
report += [f'| `{p}` | {n} | `{key}` | {status} |' for p,n,key,status in env_keys]
report += ['', '## Limits', '', 'Does not inspect database rows, deployed infrastructure, Git history, ignored logs, binary files, PDFs or images. Phone detection targets quoted Indian mobile literals; user-written biographies, URLs and uploaded documents can contain additional contacts. Public contacts deliberately typed into free text cannot be reliably removed with a field-level mask. Use moderation/data-loss-prevention for those surfaces.', '']
(ROOT/'docs/security-contact-inventory.md').write_text('\n'.join(report))
print(f'Scanned {scanned} source/configuration text files; {len(contacts)} contact occurrences; {len(candidates)} credential candidates. Inventory written with redacted values.')
