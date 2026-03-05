import { Finding } from './types'

const priorityConfig = {
    high: { emoji: '🔴', label: 'HIGH', color: '#ef5350', bg: 'rgba(239,83,80,0.08)', border: 'rgba(239,83,80,0.25)' },
    medium: { emoji: '🟠', label: 'MEDIUM', color: '#ffa726', bg: 'rgba(255,167,38,0.08)', border: 'rgba(255,167,38,0.25)' },
    low: { emoji: '🟡', label: 'LOW', color: '#fdd835', bg: 'rgba(253,216,53,0.08)', border: 'rgba(253,216,53,0.25)' },
} as const

const typeEmoji: Record<string, string> = {
    'Suspicious Task': '⚙️',
    'Suspicious JSON Schema': '📄',
    'Silent File Change': '👻',
    'MCP Server Detected': '🔌',
}

const renderFinding = (f: Finding, index: number) => {
    const sev = priorityConfig[f.priority]
    const icon = typeEmoji[f.type] ?? '🔍'

    return `
        <div class="finding" style="border-left:3px solid ${sev.border};background:${sev.bg};border-radius:8px;padding:16px 20px;margin-bottom:14px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
                <span style="font-size:1.15em;">${icon}</span>
                <span style="font-weight:700;font-size:1.05em;color:#e0e0e0;">${f.name}</span>
                <span class="badge" style="background:${sev.border};color:${sev.color};padding:2px 8px;border-radius:4px;font-size:0.75em;font-weight:700;letter-spacing:0.5px;">${sev.emoji} ${sev.label}</span>
            </div>
            <p style="margin:6px 0 8px 28px;color:#bdbdbd;font-size:0.95em;line-height:1.5;">${f.detail}</p>
            ${f.file ? `<div style="margin-left:28px;font-size:0.82em;color:#64b5f6;">📂 <code style="background:rgba(100,181,246,0.1);padding:2px 6px;border-radius:3px;">${f.file}</code></div>` : ''}
        </div>`
}

export const generateHTMLReport = (findings: Finding[], partial: boolean = false) => {
    const highCount = findings.filter(f => f.priority === 'high').length
    const medCount = findings.filter(f => f.priority === 'medium').length
    const lowCount = findings.filter(f => f.priority === 'low').length

    const summaryBadge = (emoji: string, count: number, color: string) =>
        `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(255,255,255,0.04);padding:4px 12px;border-radius:6px;font-size:0.95em;">
            ${emoji} <strong style="color:${color}">${count}</strong>
        </span>`

    const noFindings = `
        <div style="text-align:center;padding:48px 0;">
            <div style="font-size:3em;margin-bottom:12px;">🎉</div>
            <h2 style="color:#66bb6a;margin:0 0 8px;">All Clear!</h2>
            <p style="color:#9e9e9e;font-size:1em;">No suspicious findings were detected in this workspace. Stay safe! 🛡️</p>
        </div>`

    const groupedFindings = () => {
        const sections: string[] = []
        const priorities = ['high', 'medium', 'low'] as const

        for (const sev of priorities) {
            const items = findings.filter(f => f.priority === sev)
            if (items.length === 0) { continue }

            const cfg = priorityConfig[sev]
            sections.push(`
                <div style="margin-top:28px;">
                    <h3 style="color:${cfg.color};font-size:1em;margin-bottom:12px;display:flex;align-items:center;gap:8px;">
                        ${cfg.emoji} ${cfg.label} PRIORITY
                        <span style="font-size:0.8em;color:#757575;font-weight:400;">(${items.length} finding${items.length > 1 ? 's' : ''})</span>
                    </h3>
                    ${items.map((f, i) => renderFinding(f, i)).join('')}
                </div>`)
        }
        return sections.join('')
    }

    const findingsHtml = findings.length ? groupedFindings() : noFindings

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VSCode Shield Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
            margin: 0; padding: 32px;
            background: #1e1e1e; color: #e0e0e0;
            line-height: 1.6;
        }
        code { font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace; }
        .header { margin-bottom: 32px; }
        .finding { transition: background 0.15s ease; }
        .finding:hover { filter: brightness(1.15); }
        hr { border: none; border-top: 1px solid #333; margin: 24px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1 style="margin:0 0 4px;font-size:1.6em;color:#42a5f5;">
            🛡️ VSCode Shield Report
        </h1>
        ${partial
            ? `<div style="display:inline-flex;align-items:center;gap:8px;background:rgba(255,152,0,0.1);border:1px solid rgba(255,152,0,0.3);border-radius:6px;padding:6px 14px;margin-bottom:12px;font-size:0.88em;">
                    ⚡ <span style="color:#ffa726;"><strong>Partial Scan</strong> — Only recently changed files were analyzed.</span>
                </div>`
            : ''}
        <p style="margin:0 0 16px;color:#757575;font-size:0.92em;">
            ${partial ? 'Partial scan' : 'Full workspace scan'} completed — ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
            ${summaryBadge('🔴', highCount, '#ef5350')}
            ${summaryBadge('🟠', medCount, '#ffa726')}
            ${summaryBadge('🟡', lowCount, '#fdd835')}
            <span style="display:inline-flex;align-items:center;gap:4px;background:rgba(255,255,255,0.04);padding:4px 12px;border-radius:6px;font-size:0.95em;">
                📊 <strong style="color:#90caf9">${findings.length}</strong> <span style="color:#757575">total</span>
            </span>
        </div>
    </div>
    <div style="background:rgba(66,165,245,0.06);border:1px solid rgba(66,165,245,0.15);border-radius:8px;padding:16px 20px;margin-bottom:8px;">
        <p style="margin:0;color:#90caf9;font-size:0.92em;line-height:1.6;">
            🔎 <strong>What is this?</strong> — VSCode Shield scans your workspace for potential attack vectors that could compromise your development environment.
            This includes suspicious VS Code tasks, malicious JSON schema references, hidden unicode characters, unauthorized MCP servers, and silent background file modifications.
            These are common techniques used in <strong>supply chain attacks</strong> and <strong>IDE-targeted exploits</strong> to execute arbitrary code, exfiltrate data, or tamper with your project.
        </p>
    </div>
    <hr/>
    ${findingsHtml}
    <hr/>
    <p style="text-align:center;color:#616161;font-size:0.82em;margin-top:24px;">
        Generated by <strong style="color:#42a5f5;">VSCode Shield</strong> 🛡️ — Keep your workspace safe!
    </p>
</body>
</html>`
}
