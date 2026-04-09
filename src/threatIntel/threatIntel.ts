interface AikidoMalwareResult {
    id: number
    ecosystem: string
    package_name: string
    version: string
    status: string
    release_date: number
    detected_on: number
    last_updated: number
    reason_count: number
}

export class ThreatIntel {
    private baseUrl = "https://intel.aikido.dev/api/listLatestMalwarePredictions"

    public async isExtensionMalicious(extensionId: string): Promise<boolean> {
        try {
            const url = `${this.baseUrl}?page=0&per_page=100&search=${encodeURIComponent(extensionId)}&sort_by_column=release_date&ecosystem=vscode`
            const response = await fetch(url)

            if (!response.ok) {
                console.warn(`[Watchtower] Aikido API returned ${response.status} for ${extensionId}`)
                return false
            }

            const results: AikidoMalwareResult[] = await response.json() as AikidoMalwareResult[]

            return results.some(r => r.status === "MALWARE")
        } catch (error) {
            console.error(`[Watchtower] Failed to check threat intel for ${extensionId}:`, error)
            return false
        }
    }
}
