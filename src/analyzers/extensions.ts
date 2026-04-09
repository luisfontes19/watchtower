import { ThreatIntel } from '../threatIntel/threatIntel'

export class ExtensionsAnalyzer {
    public static async analyze(extensionIds: string[]): Promise<{ extensionId: string, malicious: boolean }[]> {
        const intel = new ThreatIntel()
        const proms = extensionIds.map(id => intel.isExtensionMalicious(id))

        const results = await Promise.all(proms)
        return results.map((result, index) => ({ extensionId: extensionIds[index], malicious: result }))

    }

}
