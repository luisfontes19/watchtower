export const SUSPICIOUS_COMMANDS = [
    /\bcurl\b/i,
    /\bwget\b/i,
    /\bInvoke-WebRequest\b/i,
    /\bpowershell\b/i,
    /\bcmd\b/i,
    /\bbash\b/i,
    /\bsh\b/i,
    /\bbase64\b/i,
    /\bcertutil\b/i,
    /\bftp\b/i,
    /\btelnet\b/i,
    /\bnetcat\b/i,
    /\bnc\b/i,
    /\bperl\b/i,
    /\bpython\b/i,
    /\bruby\b/i,
    /\bphp\b/i,
    /\bnode\b/i,
    /\bnpm\b/i,
    /\bpwsh\b/i,
]

export const isDangerousCommand = (command: string): boolean => {
    return SUSPICIOUS_COMMANDS.some((regex) => regex.test(command))
}
