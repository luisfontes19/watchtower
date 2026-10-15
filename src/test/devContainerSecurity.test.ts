import * as assert from 'assert'
import * as path from 'path'
import { analyzeDevContainerConfig, blockingIssues, DevContainerIssue, ReadFile } from '../devContainerSecurity'

const WORKSPACE = path.resolve('/projects/app')
const CONFIG_PATH = path.join(WORKSPACE, '.devcontainer', 'devcontainer.json')

const noFiles: ReadFile = async () => undefined

function filesReader(files: Record<string, string>): ReadFile {
    return async (absPath) => files[path.relative(WORKSPACE, absPath)]
}

async function analyze(config: unknown, readFile: ReadFile = noFiles): Promise<DevContainerIssue[]> {
    const text = typeof config === 'string' ? config : JSON.stringify(config)
    return analyzeDevContainerConfig(text, CONFIG_PATH, WORKSPACE, readFile)
}

function kinds(issues: DevContainerIssue[]): string[] {
    return issues.map(i => i.kind)
}

suite('devContainerSecurity', () => {

    suite('clean configs', () => {
        test('minimal image config has no issues', async () => {
            assert.deepStrictEqual(await analyze({ image: 'node:20' }), [])
        })

        test('JSONC comments and trailing commas are accepted', async () => {
            const issues = await analyze('{\n  // comment\n  "image": "node:20",\n}')
            assert.deepStrictEqual(issues, [])
        })

        test('empty initializeCommand is ignored', async () => {
            assert.deepStrictEqual(await analyze({ initializeCommand: '' }), [])
            assert.deepStrictEqual(await analyze({ initializeCommand: [] }), [])
        })

        test('named volume mounts are allowed', async () => {
            const issues = await analyze({ mounts: ['source=${devcontainerId}-cache,target=/cache,type=volume'] })
            assert.deepStrictEqual(issues, [])
        })

        test('binding the workspace folder and subfolders is allowed', async () => {
            const issues = await analyze({
                workspaceMount: 'source=${localWorkspaceFolder},target=/workspace,type=bind',
                mounts: [{ type: 'bind', source: '${localWorkspaceFolder}/data', target: '/data' }],
            })
            assert.deepStrictEqual(issues, [])
        })
    })

    suite('initializeCommand and runArgs', () => {
        test('string initializeCommand', async () => {
            assert.deepStrictEqual(kinds(await analyze({ initializeCommand: 'touch /tmp/x' })), ['initCommand'])
        })

        test('array and object initializeCommand', async () => {
            assert.deepStrictEqual(kinds(await analyze({ initializeCommand: ['sh', '-c', 'id'] })), ['initCommand'])
            assert.deepStrictEqual(kinds(await analyze({ initializeCommand: { a: 'id' } })), ['initCommand'])
        })

        test('elevating runArgs flags', async () => {
            for (const runArgs of [
                ['--privileged'],
                ['--cap-add=SYS_ADMIN'],
                ['--cap-add', 'SYS_ADMIN'],
                ['--device=/dev/kvm'],
                ['--security-opt', 'seccomp=unconfined'],
                ['--pid=host'],
                ['--network', 'host'],
                ['--net=host'],
            ]) {
                assert.deepStrictEqual(kinds(await analyze({ runArgs })), ['elevatedPrivileges'], runArgs.join(' '))
            }
        })

        test('harmless runArgs are ignored', async () => {
            assert.deepStrictEqual(await analyze({ runArgs: ['--init', '--name=dev', '--network=bridge', '--privileged=false'] }), [])
        })
    })

    suite('mounts', () => {
        test('host bind in mounts string', async () => {
            assert.deepStrictEqual(kinds(await analyze({ mounts: ['type=bind,source=/etc,target=/host-etc'] })), ['mount'])
        })

        test('host bind in mounts object', async () => {
            assert.deepStrictEqual(kinds(await analyze({ mounts: [{ type: 'bind', source: '${localEnv:HOME}/.ssh', target: '/ssh' }] })), ['mount'])
        })

        test('workspace subfolder escaping with .. is a mount', async () => {
            const issues = await analyze({ mounts: ['type=bind,source=${localWorkspaceFolder}/../secrets,target=/s'] })
            assert.deepStrictEqual(kinds(issues), ['mount'])
        })

        test('custom workspaceMount outside the workspace is a mount', async () => {
            assert.deepStrictEqual(kinds(await analyze({ workspaceMount: 'source=/,target=/host,type=bind' })), ['mount'])
        })

        test('runArgs -v with host path', async () => {
            assert.deepStrictEqual(kinds(await analyze({ runArgs: ['-v', '/home/me:/home'] })), ['mount'])
            assert.deepStrictEqual(kinds(await analyze({ runArgs: ['--volume=/home/me:/home'] })), ['mount'])
        })

        test('runArgs -v with named volume is allowed', async () => {
            assert.deepStrictEqual(await analyze({ runArgs: ['-v', 'cache:/cache'] }), [])
        })

        test('runArgs --mount host bind', async () => {
            assert.deepStrictEqual(kinds(await analyze({ runArgs: ['--mount', 'type=bind,src=/a,dst=/b'] })), ['mount'])
        })
    })

    suite('docker socket', () => {
        test('mount of docker.sock is reported as docker socket only', async () => {
            const issues = await analyze({ mounts: ['source=/var/run/docker.sock,target=/var/run/docker.sock,type=bind'] })
            assert.deepStrictEqual(kinds(issues), ['dockerSocket'])
        })

        test('runArgs -v docker.sock', async () => {
            assert.deepStrictEqual(kinds(await analyze({ runArgs: ['-v', '/var/run/docker.sock:/var/run/docker.sock'] })), ['dockerSocket'])
        })

        test('windows named pipe', async () => {
            const issues = await analyze({ mounts: ['source=\\\\.\\pipe\\docker_engine,target=\\\\.\\pipe\\docker_engine,type=bind'] })
            assert.deepStrictEqual(kinds(issues), ['dockerSocket'])
        })

        test('docker-outside-of-docker feature', async () => {
            const issues = await analyze({ features: { 'ghcr.io/devcontainers/features/docker-outside-of-docker:1': {} } })
            assert.deepStrictEqual(kinds(issues), ['dockerSocket'])
        })

        test('other features are fine', async () => {
            assert.deepStrictEqual(await analyze({ features: { 'ghcr.io/devcontainers/features/node:1': {} } }), [])
        })
    })

    suite('docker compose', () => {
        const compose = (volumes: string, extra = '') => ({
            '.devcontainer/docker-compose.yml': `services:\n  app:\n    image: node\n${extra}${volumes}`,
        })
        const withCompose = { dockerComposeFile: 'docker-compose.yml', service: 'app' }

        test('workspace bind (..:/workspace) is allowed', async () => {
            const files = compose('    volumes:\n      - ..:/workspace:cached\n')
            assert.deepStrictEqual(await analyze(withCompose, filesReader(files)), [])
        })

        test('named volumes and long syntax volumes are allowed', async () => {
            const files = compose('    volumes:\n      - cache:/cache\n      - type: volume\n        source: data\n        target: /data\n')
            assert.deepStrictEqual(await analyze(withCompose, filesReader(files)), [])
        })

        test('bind outside the workspace', async () => {
            const files = compose('    volumes:\n      - /etc:/host-etc\n')
            assert.deepStrictEqual(kinds(await analyze(withCompose, filesReader(files))), ['mount'])
        })

        test('relative bind escaping the workspace', async () => {
            const files = compose('    volumes:\n      - ../../other:/other\n')
            assert.deepStrictEqual(kinds(await analyze(withCompose, filesReader(files))), ['mount'])
        })

        test('home and variable binds are mounts', async () => {
            const files = compose('    volumes:\n      - ~/.ssh:/ssh\n      - ${DATA}:/data\n')
            assert.deepStrictEqual(kinds(await analyze(withCompose, filesReader(files))), ['mount', 'mount'])
        })

        test('long syntax bind', async () => {
            const files = compose('    volumes:\n      - type: bind\n        source: /srv\n        target: /srv\n')
            assert.deepStrictEqual(kinds(await analyze(withCompose, filesReader(files))), ['mount'])
        })

        test('docker socket in compose', async () => {
            const files = compose('    volumes:\n      - /var/run/docker.sock:/var/run/docker.sock\n')
            assert.deepStrictEqual(kinds(await analyze(withCompose, filesReader(files))), ['dockerSocket'])
        })

        test('privileged service', async () => {
            const files = compose('', '    privileged: true\n')
            assert.deepStrictEqual(kinds(await analyze(withCompose, filesReader(files))), ['elevatedPrivileges'])
        })

        test('array of compose files is all checked', async () => {
            const files = {
                '.devcontainer/a.yml': 'services:\n  app:\n    image: node\n',
                '.devcontainer/b.yml': 'services:\n  app:\n    volumes:\n      - /:/host\n',
            }
            const issues = await analyze({ dockerComposeFile: ['a.yml', 'b.yml'] }, filesReader(files))
            assert.deepStrictEqual(kinds(issues), ['mount'])
        })

        test('missing compose file is unverifiable', async () => {
            assert.deepStrictEqual(kinds(await analyze(withCompose)), ['unverifiable'])
        })

        test('malformed compose file is unverifiable', async () => {
            const files = { '.devcontainer/docker-compose.yml': 'services: [unclosed\n  - : :' }
            assert.deepStrictEqual(kinds(await analyze(withCompose, filesReader(files))), ['unverifiable'])
        })

        test('include and extends are unverifiable', async () => {
            const included = { '.devcontainer/docker-compose.yml': 'include:\n  - other.yml\nservices:\n  app:\n    image: node\n' }
            assert.deepStrictEqual(kinds(await analyze(withCompose, filesReader(included))), ['unverifiable'])

            const extended = { '.devcontainer/docker-compose.yml': 'services:\n  app:\n    extends:\n      file: other.yml\n      service: base\n' }
            assert.deepStrictEqual(kinds(await analyze(withCompose, filesReader(extended))), ['unverifiable'])
        })
    })

    suite('unparsable config', () => {
        test('invalid JSON fails closed', async () => {
            assert.deepStrictEqual(kinds(await analyze('{ "image": ')), ['unverifiable'])
        })

        test('non-object JSON fails closed', async () => {
            assert.deepStrictEqual(kinds(await analyze('[]')), ['unverifiable'])
        })
    })

    suite('blockingIssues', () => {
        const all: DevContainerIssue[] = [
            { kind: 'initCommand', message: 'a' },
            { kind: 'elevatedPrivileges', message: 'b' },
            { kind: 'mount', message: 'c' },
            { kind: 'dockerSocket', message: 'd' },
            { kind: 'unverifiable', message: 'e' },
        ]

        test('both settings on keep everything', () => {
            assert.strictEqual(blockingIssues(all, { onlyIfNoInitCommands: true, onlyIfNoMounts: true }).length, 5)
        })

        test('onlyIfNoInitCommands off drops init commands and privileges', () => {
            const kept = kinds(blockingIssues(all, { onlyIfNoInitCommands: false, onlyIfNoMounts: true }))
            assert.deepStrictEqual(kept, ['mount', 'dockerSocket', 'unverifiable'])
        })

        test('onlyIfNoMounts off drops mounts only', () => {
            const kept = kinds(blockingIssues(all, { onlyIfNoInitCommands: true, onlyIfNoMounts: false }))
            assert.deepStrictEqual(kept, ['initCommand', 'elevatedPrivileges', 'dockerSocket', 'unverifiable'])
        })

        test('docker socket and unverifiable always block', () => {
            const kept = kinds(blockingIssues(all, { onlyIfNoInitCommands: false, onlyIfNoMounts: false }))
            assert.deepStrictEqual(kept, ['dockerSocket', 'unverifiable'])
        })
    })
})
