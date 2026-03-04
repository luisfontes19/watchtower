import { Finding } from './types'

export const generateHTMLReport = (findings: Finding[]) => {


    const findingsHtml = findings.length
        ? `<table style="width:100%;border-collapse:collapse;">
                                <thead>
                                    <tr>
                                        <th style='border-bottom:1px solid #ccc;text-align:left;padding:8px;'>Severity</th>
                                        <th style='border-bottom:1px solid #ccc;text-align:left;padding:8px;'>Name</th>
                                        <th style='border-bottom:1px solid #ccc;text-align:left;padding:8px;'>Detail</th>
                                        <th style='border-bottom:1px solid #ccc;text-align:left;padding:8px;'>Source</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${findings.map(f => `
                                        <tr>
                                            <td style='padding:8px;color:${f.severity === 'high' ? '#b71c1c' : f.severity === 'medium' ? '#fbc02d' : '#388e3c'};font-weight:bold;'>${f.severity.toUpperCase()}</td>
                                            <td style='padding:8px;'>${f.name}</td>
                                            <td style='padding:8px;'>${f.detail}</td>
                                            <td style='padding:8px;color:#90caf9;'>${f.file || 'N/A'}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>`
        : '<p style="color:#388e3c;font-size:1.1em;">No suspicious findings.</p>'

    return `
                        <!DOCTYPE html>
                        <html lang="en">
                        <head>
                                <meta charset="UTF-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                <title>VSCode Shield Findings</title>
                                <style>
                                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; margin: 24px; background: #1e1e1e; color: #eee; }
                                    h1 { color: #42a5f5; }
                                    table { background: #232323; border-radius: 8px; overflow: hidden; }
                                    th, td { border-bottom: 1px solid #333; }
                                    th { background: #263238; }
                                    tr:last-child td { border-bottom: none; }
                                </style>
                        </head>
                        <body>
                                <h1>VSCode Shield Findings</h1>
                                ${findingsHtml}
                        </body>
                        </html>
                `
}
