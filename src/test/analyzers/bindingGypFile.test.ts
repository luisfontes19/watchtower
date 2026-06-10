import * as assert from 'assert'
import * as vscode from 'vscode'
import '../../analyzers/agentsFile' // load before to resolve circular dep
import { BindingGypAnalyzer } from '../../analyzers/bindingGypFile'
import { FindingType } from '../../types'

suite('BindingGypAnalyzer', () => {

    let analyzer: BindingGypAnalyzer

    setup(() => {
        analyzer = new BindingGypAnalyzer()
    })

    suite('canScanFile', () => {

        test('returns true for binding.gyp', () => {
            assert.strictEqual(analyzer.canScanFile(vscode.Uri.file('/project/binding.gyp')), true)
        })

        test('returns true for nested binding.gyp', () => {
            assert.strictEqual(analyzer.canScanFile(vscode.Uri.file('/project/packages/native-addon/binding.gyp')), true)
        })

        test('returns true for bindings.gyp', () => {
            assert.strictEqual(analyzer.canScanFile(vscode.Uri.file('/project/bindings.gyp')), true)
        })

        test('returns false for gypi files', () => {
            assert.strictEqual(analyzer.canScanFile(vscode.Uri.file('/project/config.gypi')), false)
        })

        test('returns false for unrelated files', () => {
            assert.strictEqual(analyzer.canScanFile(vscode.Uri.file('/project/package.json')), false)
        })
    })

    suite('checkFile', () => {

        test('flags binding.gyp by presence even without suspicious patterns', async () => {
            const uri = vscode.Uri.file('/project/binding.gyp')
            const content = new TextEncoder().encode('{"targets": []}')

            const findings = await analyzer.checkFile(uri, content)

            assert.strictEqual(findings.length, 1)
            assert.strictEqual(findings[0].type, FindingType.BindingGyp)
            assert.strictEqual(findings[0].priority, 'medium')
            assert.ok(findings[0].name.includes('binding.gyp detected'))
            assert.ok(findings[0].detail.includes('node-gyp automatically'))
            assert.ok(findings[0].detail.includes('aikido.dev/blog/exploring-binding-gyp-npm-build-system'))
            assert.strictEqual(findings[0].range, undefined)
        })

        test('raises priority when command expansion is present', async () => {
            const uri = vscode.Uri.file('/project/binding.gyp')
            const content = new TextEncoder().encode(`{
  "targets": [
    {
      "target_name": "Setup",
      "type": "none",
      "sources": ["<!(node index.js > /dev/null 2>&1 && echo stub.c)"]
    }
  ]
}`)

            const findings = await analyzer.checkFile(uri, content)

            assert.strictEqual(findings.length, 1)
            assert.strictEqual(findings[0].type, FindingType.BindingGyp)
            assert.strictEqual(findings[0].priority, 'high')
            assert.ok(findings[0].name.includes('GYP command expansion token'))
            assert.ok(findings[0].detail.includes('Matched pattern'))
            assert.ok(findings[0].range)
        })

        test('raises priority when python sandbox-escape markers are present', async () => {
            const uri = vscode.Uri.file('/project/binding.gyp')
            const content = new TextEncoder().encode(`{
  "variables": {
        "openssl_fips": "__import__('os')"
  },
  "targets": []
}`)

            const findings = await analyzer.checkFile(uri, content)

            assert.strictEqual(findings.length, 1)
            assert.strictEqual(findings[0].priority, 'high')
            assert.ok(findings[0].name.includes('Python sandbox-escape marker'))
        })

        test('emits one finding per indicator match', async () => {
            const uri = vscode.Uri.file('/project/binding.gyp')
            const content = new TextEncoder().encode(`{
  "includes": ["evil"],
  "targets": [
    {
      "target_name": "via_actions",
      "actions": [{ "action": ["node", "evil.js"] }],
      "make_global_settings": [["CC_wrapper", "./cc-evil-wrapper.sh"]]
    }
  ]
}`)

            const findings = await analyzer.checkFile(uri, content)

            assert.strictEqual(findings.length, 3)
            const names = findings.map(f => f.name)
            assert.ok(names.some(n => n.includes('Cross-file execution surface')))
            assert.ok(names.some(n => n.includes('Build action/rule/postbuild command block')))
            assert.ok(names.some(n => n.includes('Compiler/toolchain override')))
        })
    })

    suite('alertOnEditedInBackground', () => {

        test('returns false', () => {
            assert.strictEqual(analyzer.alertOnEditedInBackground(), false)
        })
    })
})
