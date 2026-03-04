import * as jsonc from 'jsonc-parser'
import * as vscode from 'vscode'
import { Finding, FindingType } from '../types'
import { Analyzer, JsonFileAnalyzerParams } from './types'

const MAX_PARAM_LENGTH = 30
const MAX_PARAM_COUNT = 10

export class JsonFile implements Analyzer {
    constructor() { }

    public async analyze(params: JsonFileAnalyzerParams): Promise<Finding[]> {
        const json = (typeof params.json === 'string') ? jsonc.parse(params.json) : params.json as Record<string, unknown>
        const findings: Finding[] = []

        if (!("$schema" in json)) return findings

        const schema = json["$schema"] as string
        findings.push(...JsonFile.checkSchemaUrl(schema))

        return findings
    }

    public static checkSchemaUrl(url: string): Finding[] {
        const findings: Finding[] = []
        const uri = vscode.Uri.parse(url)
        const query = uri.query

        if (!query) return findings

        const params = new URLSearchParams(query)
        const entries = [...params.entries()]

        if (entries.length > MAX_PARAM_COUNT) {
            findings.push({
                type: FindingType.JsonSchema,
                name: '$schema',
                detail: `Schema URL contains ${entries.length} query parameters. A high number of query parameters may indicate potential data exfiltration (max ${MAX_PARAM_COUNT})`,
                severity: 'medium',
                file: '.vscode/settings.json'
            })
        }

        for (const [name, value] of entries) {
            if (name.length > MAX_PARAM_LENGTH) {
                findings.push({
                    type: FindingType.JsonSchema,
                    name: '$schema',
                    detail: `Schema URL query parameter name "${name}" is ${name.length} chars. It seems too big, which may indicate data exfiltration (max ${MAX_PARAM_LENGTH})`,
                    severity: 'medium',
                    file: '.vscode/settings.json'
                })
            }
            if (value.length > MAX_PARAM_LENGTH) {
                findings.push({
                    type: FindingType.JsonSchema,
                    name: '$schema',
                    detail: `Schema URL query parameter value "${value}" is ${value.length} chars. It seems too big, which may indicate data exfiltration (max ${MAX_PARAM_LENGTH})`,
                    severity: 'medium',
                    file: '.vscode/settings.json'
                })
            }
        }

        return findings
    }
}
