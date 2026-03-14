import * as assert from 'assert'
import * as vscode from 'vscode'
import '../../analyzers/agentsFile' // load before to resolve circular dep
import { PythonVenv } from '../../analyzers/pythonVenv'
import { FindingType } from '../../types'

suite('PythonVenv', () => {

    let analyzer: PythonVenv

    setup(() => {
        analyzer = new PythonVenv()
    })

    suite('canScanFile', () => {

        test('returns true for python binary in .venv', () => {
            assert.strictEqual(analyzer.canScanFile(vscode.Uri.file('/project/.venv/bin/python')), true)
        })

        test('returns true for nested project venv python binary', () => {
            assert.strictEqual(analyzer.canScanFile(vscode.Uri.file('/home/user/project/.venv/bin/python')), true)
        })

        test('returns false for regular python files', () => {
            assert.strictEqual(analyzer.canScanFile(vscode.Uri.file('/project/script.py')), false)
        })

        test('returns false for python binary outside venv', () => {
            assert.strictEqual(analyzer.canScanFile(vscode.Uri.file('/usr/bin/python')), false)
        })

        test('returns false for other venv files', () => {
            assert.strictEqual(analyzer.canScanFile(vscode.Uri.file('/project/.venv/bin/pip')), false)
        })
    })

    suite('checkFile', () => {

        test('returns finding for venv python binary', async () => {
            const uri = vscode.Uri.file('/project/.venv/bin/python')
            const findings = await analyzer.checkFile(uri)
            assert.strictEqual(findings.length, 1)
            assert.strictEqual(findings[0].type, FindingType.Binary)
            assert.strictEqual(findings[0].priority, 'high')
            assert.ok(findings[0].name.includes('Python venv binary'))
            assert.ok(findings[0].detail.includes('.venv'))
        })

        test('finding includes file path', async () => {
            const uri = vscode.Uri.file('/project/.venv/bin/python')
            const findings = await analyzer.checkFile(uri)
            assert.strictEqual(findings.length, 1)
            assert.ok(findings[0].file)
        })
    })

    suite('alertOnEditedInBackground', () => {

        test('returns false', () => {
            assert.strictEqual(analyzer.alertOnEditedInBackground(), false)
        })
    })
})
