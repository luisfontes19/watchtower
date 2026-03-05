import * as jsonc from 'jsonc-parser'
import * as vscode from 'vscode'
import { Finding, FindingType } from '../types'
import { StaticAnalyzer } from './staticAnalyzer'

const MAX_PARAM_LENGTH = 30
const MAX_PARAM_COUNT = 10

export class JsonFile extends StaticAnalyzer {

    async checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        const findings: Finding[] = []
        const data = content ?? await vscode.workspace.fs.readFile(uri)

        const json = jsonc.parse(data.toString())
        if (!json?.["$schema"]) return []

        const schema = json["$schema"] as string

        findings.push(...this.checkSchemaUrl(schema, uri))

        return findings
    }

    checkSchemaUrl(url: string, fileUri: vscode.Uri): Finding[] {
        const findings: Finding[] = []
        const uri = vscode.Uri.parse(url)
        const query = uri.query

        if (!query) return findings

        const params = new URLSearchParams(query)
        const entries = [...params.entries()]

        if (entries.length > MAX_PARAM_COUNT) {
            findings.push({
                type: FindingType.JsonSchema,
                name: `Potential data exfiltration via json $schema in ${url} (Too many query params)`,
                detail: `Schema URL contains ${entries.length} query parameters. A high number of query parameters may indicate potential data exfiltration`,
                priority: 'medium',
                file: fileUri.fsPath
            })
        }

        for (const [name, value] of entries) {
            if (name.length > MAX_PARAM_LENGTH) {
                findings.push({
                    type: FindingType.JsonSchema,
                    name: `Potential data exfiltration via json $schema in ${url} (Big query param name)`,
                    detail: `Schema URL query parameter name "${name}" is ${name.length} chars. It seems too big, which may indicate data exfiltration (max ${MAX_PARAM_LENGTH})`,
                    priority: 'medium',
                    file: fileUri.fsPath
                })
            }
            if (value.length > MAX_PARAM_LENGTH) {
                findings.push({
                    type: FindingType.JsonSchema,
                    name: `Potential data exfiltration via json $schema in ${url} (Big query param value)`,
                    detail: `Schema URL query parameter value "${value}" is ${value.length} chars. It seems too big, which may indicate data exfiltration (max ${MAX_PARAM_LENGTH})`,
                    priority: 'medium',
                    file: fileUri.fsPath
                })
            }
        }

        return findings
    }
}
