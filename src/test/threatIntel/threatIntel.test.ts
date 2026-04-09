import * as assert from 'assert'
import { ThreatIntel } from '../../threatIntel/threatIntel'

suite('ThreatIntel', () => {
    let threatIntel: ThreatIntel
    let originalFetch: typeof fetch

    setup(() => {
        threatIntel = new ThreatIntel()
        originalFetch = global.fetch
    })

    teardown(() => {
        global.fetch = originalFetch
    })

    suite('isExtensionMalicious', () => {

        test('returns true for aikidosecurity.aikido-endpoint-test when API returns MALWARE', async () => {
            global.fetch = async () => ({
                ok: true,
                json: async () => [{ status: 'MALWARE', package_name: 'aikido-endpoint-test', ecosystem: 'vscode' }]
            }) as unknown as Response

            const result = await threatIntel.isExtensionMalicious('aikidosecurity.aikido-endpoint-test')
            assert.strictEqual(result, true)
        })

        test('returns false for luisfontes19.watchtower when API returns empty results', async () => {
            global.fetch = async () => ({
                ok: true,
                json: async () => []
            }) as unknown as Response

            const result = await threatIntel.isExtensionMalicious('luisfontes19.watchtower')
            assert.strictEqual(result, false)
        })

        test('returns false when all entries have non-MALWARE status', async () => {
            global.fetch = async () => ({
                ok: true,
                json: async () => [{ status: 'SAFE' }]
            }) as unknown as Response

            const result = await threatIntel.isExtensionMalicious('luisfontes19.watchtower')
            assert.strictEqual(result, false)
        })

        test('returns false when response is not ok', async () => {
            global.fetch = async () => ({ ok: false, status: 500 }) as unknown as Response

            const result = await threatIntel.isExtensionMalicious('aikidosecurity.aikido-endpoint-test')
            assert.strictEqual(result, false)
        })

        test('returns false when fetch throws', async () => {
            global.fetch = async () => { throw new Error('Network error') }

            const result = await threatIntel.isExtensionMalicious('luisfontes19.watchtower')
            assert.strictEqual(result, false)
        })

        test('includes the extension id in the request URL', async () => {
            let capturedUrl = ''
            global.fetch = async (url: string | URL | Request) => {
                capturedUrl = url.toString()
                return { ok: true, json: async () => [] } as unknown as Response
            }

            await threatIntel.isExtensionMalicious('aikidosecurity.aikido-endpoint-test')
            assert.ok(capturedUrl.includes('aikidosecurity'))
        })

        test('scopes the request to the vscode ecosystem', async () => {
            let capturedUrl = ''
            global.fetch = async (url: string | URL | Request) => {
                capturedUrl = url.toString()
                return { ok: true, json: async () => [] } as unknown as Response
            }

            await threatIntel.isExtensionMalicious('any-extension')
            assert.ok(capturedUrl.includes('ecosystem=vscode'))
        })
    })
})
