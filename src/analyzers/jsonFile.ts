import * as jsonc from 'jsonc-parser'
import * as vscode from 'vscode'
import { Finding, FindingType } from '../types'
import { findFiles } from '../utils'
import { StaticAnalyzer } from './types'

const MAX_PARAM_LENGTH = 30
const MAX_PARAM_COUNT = 10

export class JsonFile extends StaticAnalyzer {

    async analyze(): Promise<Finding[]> {
        const findings: Finding[] = []

        const jsonFiles = await findFiles('**/*.json')
        console.log("Found JSON files:", jsonFiles.map(f => f.fsPath))

        const results = await Promise.all(
            jsonFiles.map(file =>
                vscode.workspace.fs.readFile(file).then(content => {
                    return this.checkFile(file, content)
                })
            )
        )

        findings.push(...results.flat())

        return findings
    }

    async checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        const findings: Finding[] = []
        const data = content ?? await vscode.workspace.fs.readFile(uri)

        const json = jsonc.parse(data.toString())
        if (!json?.["$schema"]) return []

        const schema = json["$schema"] as string

        findings.push(...this.checkSchemaUrl(schema))

        return findings
    }

    async onChange(uri: vscode.Uri): Promise<Finding[]> {
        return this.checkFile(uri)
    }

    checkSchemaUrl(url: string): Finding[] {
        const findings: Finding[] = []
        const uri = vscode.Uri.parse(url)
        const query = uri.query

        if (!query) return findings

        const params = new URLSearchParams(query)
        const entries = [...params.entries()]

        if (entries.length > MAX_PARAM_COUNT) {
            findings.push({
                type: FindingType.JsonSchema,
                name: 'Potential Data Exfiltration via Json $schema',
                detail: `Schema URL contains ${entries.length} query parameters. A high number of query parameters may indicate potential data exfiltration (max ${MAX_PARAM_COUNT})`,
                severity: 'medium',
                file: '.vscode/settings.json'
            })
        }

        for (const [name, value] of entries) {
            if (name.length > MAX_PARAM_LENGTH) {
                findings.push({
                    type: FindingType.JsonSchema,
                    name: 'Potential Data Exfiltration via Json $schema',
                    detail: `Schema URL query parameter name "${name}" is ${name.length} chars. It seems too big, which may indicate data exfiltration (max ${MAX_PARAM_LENGTH})`,
                    severity: 'medium',
                    file: '.vscode/settings.json'
                })
            }
            if (value.length > MAX_PARAM_LENGTH) {
                findings.push({
                    type: FindingType.JsonSchema,
                    name: 'Potential Data Exfiltration via Json $schema',
                    detail: `Schema URL query parameter value "${value}" is ${value.length} chars. It seems too big, which may indicate data exfiltration (max ${MAX_PARAM_LENGTH})`,
                    severity: 'medium',
                    file: '.vscode/settings.json'
                })
            }
        }

        return findings
    }
}
