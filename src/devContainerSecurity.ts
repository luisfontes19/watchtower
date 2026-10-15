import * as jsonc from 'jsonc-parser'
import * as path from 'path'
import { parse as parseYaml } from 'yaml'

export type DevContainerIssueKind =
    | 'initCommand'
    | 'elevatedPrivileges'
    | 'mount'
    | 'dockerSocket'
    | 'unverifiable'

export interface DevContainerIssue {
    kind: DevContainerIssueKind
    message: string
}

/** Reads a file by absolute path, returning undefined if it can't be read */
export type ReadFile = (absPath: string) => Promise<string | undefined>

interface MountSpec {
    type?: string
    source?: string
    target?: string
}

const SOCKET_PATTERN = /(docker|podman|containerd|crio)(\.sock|_engine)/i
const DOCKER_SOCKET_FEATURE_PATTERN = /docker-(outside-of|from)-docker/i
const HOST_NAMESPACE_FLAGS = ['--pid', '--ipc', '--network', '--net', '--userns', '--uts']
const ELEVATING_FLAGS = ['--cap-add', '--device', '--security-opt']

function isDockerSocket(...values: (string | undefined)[]): boolean {
    return values.some(v => v !== undefined && SOCKET_PATTERN.test(v))
}

function looksLikePath(source: string | undefined): boolean {
    return source !== undefined && /^([/.~$]|[A-Za-z]:[\\/]|\\\\)/.test(source)
}

function isHostBind(spec: MountSpec): boolean {
    if (spec.type !== undefined)
        return spec.type === 'bind'
    return looksLikePath(spec.source)
}

function isNonEmptyCommand(value: unknown): boolean {
    if (typeof value === 'string') return value.trim().length > 0
    if (Array.isArray(value)) return value.length > 0
    if (value && typeof value === 'object') return Object.keys(value).length > 0
    return false
}

/** "type=bind,source=/a,target=/b" (docker --mount syntax, also used in devcontainer.json mounts) */
function parseMountString(value: string): MountSpec {
    const spec: MountSpec = {}
    for (const part of value.split(',')) {
        const [rawKey, ...rest] = part.split('=')
        const val = rest.join('=').trim()
        switch (rawKey.trim().toLowerCase()) {
            case 'type': spec.type = val.toLowerCase(); break
            case 'source':
            case 'src': spec.source = val; break
            case 'target':
            case 'destination':
            case 'dst': spec.target = val; break
        }
    }
    return spec
}

/** "src:dst[:mode]" (docker -v and compose short syntax). No ':' means an anonymous volume */
function parseShortVolume(value: string): MountSpec {
    const parts = value.split(':')
    if (/^[A-Za-z]:[\\/]/.test(value) && parts.length > 1)
        parts.splice(0, 2, `${parts[0]}:${parts[1]}`)
    if (parts.length === 1) return { target: parts[0] }
    return { source: parts[0], target: parts[1] }
}

/** devcontainer.json variable form: only ${localWorkspaceFolder} and its subfolders are acceptable bind sources */
function isInsideWorkspaceVariable(source: string | undefined): boolean {
    if (!source) return false
    const match = /^\$\{localWorkspaceFolder\}(.*)$/.exec(source)
    if (!match) return false
    const rest = match[1]
    if (rest === '') return true
    return /^[\\/]/.test(rest) && !rest.includes('${') && !rest.split(/[\\/]/).includes('..')
}

/** Plain paths (compose files): resolve relative to the file and require the result to stay in the workspace */
function isInsideWorkspacePath(source: string | undefined, baseDir: string, workspaceDir: string): boolean {
    if (!source || source.startsWith('$') || source.startsWith('~')) return false
    const rel = path.relative(workspaceDir, path.resolve(baseDir, source))
    return rel === '' || (rel.split(path.sep)[0] !== '..' && !path.isAbsolute(rel))
}

function describeMount(spec: MountSpec): string {
    return `'${spec.source ?? ''}' -> '${spec.target ?? ''}'`
}

function checkRunArgs(runArgs: unknown, issues: DevContainerIssue[]): void {
    if (!Array.isArray(runArgs)) return
    const args = runArgs.filter((a): a is string => typeof a === 'string')

    for (let i = 0; i < args.length; i++) {
        const [flag, inlineValue] = splitFlag(args[i])
        const nextValue = (): string | undefined => inlineValue ?? args[i + 1]

        if (flag === '--privileged') {
            if (inlineValue?.toLowerCase() !== 'false')
                issues.push({ kind: 'elevatedPrivileges', message: "runArgs contains '--privileged'" })
        } else if (ELEVATING_FLAGS.includes(flag)) {
            issues.push({ kind: 'elevatedPrivileges', message: `runArgs contains '${args[i]}'` })
        } else if (HOST_NAMESPACE_FLAGS.includes(flag)) {
            if (nextValue()?.toLowerCase() === 'host')
                issues.push({ kind: 'elevatedPrivileges', message: `runArgs shares the host namespace ('${flag} host')` })
        } else if (flag === '-v' || flag === '--volume') {
            const value = nextValue()
            if (value !== undefined) checkMount(parseShortVolume(value), 'runArgs', issues)
        } else if (flag === '--mount') {
            const value = nextValue()
            if (value !== undefined) checkMount(parseMountString(value), 'runArgs', issues)
        }
    }
}

function splitFlag(arg: string): [string, string | undefined] {
    if (arg.startsWith('--') && arg.includes('=')) {
        const idx = arg.indexOf('=')
        return [arg.slice(0, idx), arg.slice(idx + 1)]
    }
    return [arg, undefined]
}

function checkMount(spec: MountSpec, origin: string, issues: DevContainerIssue[], insideWorkspace = isInsideWorkspaceVariable(spec.source)): void {
    if (isDockerSocket(spec.source, spec.target)) {
        issues.push({ kind: 'dockerSocket', message: `${origin} binds the container engine socket (${describeMount(spec)})` })
        return
    }
    if (isHostBind(spec) && !insideWorkspace)
        issues.push({ kind: 'mount', message: `${origin} bind mounts a host path (${describeMount(spec)})` })
}

function checkDevContainerMounts(json: Record<string, unknown>, issues: DevContainerIssue[]): void {
    if (Array.isArray(json.mounts)) {
        for (const entry of json.mounts) {
            if (typeof entry === 'string')
                checkMount(parseMountString(entry), 'mounts', issues)
            else if (entry && typeof entry === 'object')
                checkMount(entry as MountSpec, 'mounts', issues)
        }
    }
    if (typeof json.workspaceMount === 'string')
        checkMount(parseMountString(json.workspaceMount), 'workspaceMount', issues)
}

function checkFeatures(json: Record<string, unknown>, issues: DevContainerIssue[]): void {
    const features = json.features
    if (!features || typeof features !== 'object') return
    for (const id of Object.keys(features)) {
        if (DOCKER_SOCKET_FEATURE_PATTERN.test(id))
            issues.push({ kind: 'dockerSocket', message: `feature '${id}' gives the container access to the host's container engine socket` })
    }
}

function checkComposeService(name: string, service: Record<string, unknown>, file: string, composeDir: string, workspaceDir: string, issues: DevContainerIssue[]): void {
    const origin = `${file} (service '${name}')`

    if (service.extends !== undefined)
        issues.push({ kind: 'unverifiable', message: `${origin} uses 'extends', which can't be verified` })

    const elevated = service.privileged === true
        || (Array.isArray(service.cap_add) && service.cap_add.length > 0)
        || (Array.isArray(service.devices) && service.devices.length > 0)
        || (Array.isArray(service.security_opt) && service.security_opt.length > 0)
        || [service.pid, service.ipc, service.network_mode, service.userns_mode, service.uts].some(v => v === 'host')
    if (elevated)
        issues.push({ kind: 'elevatedPrivileges', message: `${origin} requests elevated privileges or shares host namespaces` })

    if (!Array.isArray(service.volumes)) return
    for (const volume of service.volumes) {
        let spec: MountSpec
        if (typeof volume === 'string') {
            spec = parseShortVolume(volume)
        } else if (volume && typeof volume === 'object') {
            const v = volume as Record<string, unknown>
            spec = {
                type: typeof v.type === 'string' ? v.type : undefined,
                source: typeof v.source === 'string' ? v.source : undefined,
                target: typeof v.target === 'string' ? v.target : undefined,
            }
        } else {
            continue
        }
        checkMount(spec, origin, issues, isInsideWorkspacePath(spec.source, composeDir, workspaceDir))
    }
}

async function checkComposeFiles(json: Record<string, unknown>, configDir: string, workspaceDir: string, readFile: ReadFile, issues: DevContainerIssue[]): Promise<void> {
    const raw = json.dockerComposeFile
    const files = (typeof raw === 'string' ? [raw] : Array.isArray(raw) ? raw : []).filter((f): f is string => typeof f === 'string')

    for (const file of files) {
        const absPath = path.resolve(configDir, file)
        const display = path.relative(workspaceDir, absPath) || file
        const text = await readFile(absPath)
        if (text === undefined) {
            issues.push({ kind: 'unverifiable', message: `compose file '${display}' could not be read` })
            continue
        }

        let compose: unknown
        try {
            compose = parseYaml(text)
        } catch {
            issues.push({ kind: 'unverifiable', message: `compose file '${display}' could not be parsed` })
            continue
        }
        if (!compose || typeof compose !== 'object') continue

        const doc = compose as Record<string, unknown>
        if (doc.include !== undefined)
            issues.push({ kind: 'unverifiable', message: `compose file '${display}' uses 'include', which can't be verified` })

        const services = doc.services
        if (!services || typeof services !== 'object') continue
        for (const [name, service] of Object.entries(services)) {
            if (service && typeof service === 'object')
                checkComposeService(name, service as Record<string, unknown>, display, path.dirname(absPath), workspaceDir, issues)
        }
    }
}

/**
 * Looks for anything in a devcontainer.json (and the compose files it references) that reaches
 * the host: commands run on the host, elevated container privileges and bind mounts.
 * Anything that can't be verified is reported so callers can fail closed.
 */
export async function analyzeDevContainerConfig(text: string, configPath: string, workspaceDir: string, readFile: ReadFile): Promise<DevContainerIssue[]> {
    const issues: DevContainerIssue[] = []
    const configName = path.relative(workspaceDir, configPath) || configPath

    const errors: jsonc.ParseError[] = []
    const json = jsonc.parse(text, errors, { allowTrailingComma: true })
    if (errors.length > 0 || !json || typeof json !== 'object' || Array.isArray(json)) {
        return [{ kind: 'unverifiable', message: `${configName} could not be parsed` }]
    }
    const config = json as Record<string, unknown>

    if (isNonEmptyCommand(config.initializeCommand))
        issues.push({ kind: 'initCommand', message: `${configName} defines 'initializeCommand', which runs on your machine before the container starts` })

    checkRunArgs(config.runArgs, issues)
    checkDevContainerMounts(config, issues)
    checkFeatures(config, issues)
    await checkComposeFiles(config, path.dirname(configPath), workspaceDir, readFile, issues)

    return issues
}

/** Keeps only the issues the user's settings say should prevent an automatic open */
export function blockingIssues(issues: DevContainerIssue[], options: { onlyIfNoInitCommands: boolean, onlyIfNoMounts: boolean }): DevContainerIssue[] {
    return issues.filter(issue => {
        switch (issue.kind) {
            case 'initCommand':
            case 'elevatedPrivileges':
                return options.onlyIfNoInitCommands
            case 'mount':
                return options.onlyIfNoMounts
            default:
                return true // docker socket and unverifiable configs always block
        }
    })
}
