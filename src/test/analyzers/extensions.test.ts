import * as assert from 'assert'
import { ExtensionsAnalyzer } from '../../analyzers/extensions'

suite('ExtensionsAnalyzer', () => {
    let originalFetch: typeof fetch

    setup(() => {
        originalFetch = global.fetch
    })

    teardown(() => {
        global.fetch = originalFetch
    })

    suite('analyze', () => {

        test('returns empty array for empty input', async () => {
            const results = await ExtensionsAnalyzer.analyze([])
            assert.strictEqual(results.length, 0)
        })

        test('marks aikidosecurity.aikido-endpoint-test as malicious', async () => {
            global.fetch = async () => ({
                ok: true,
                json: async () => [{ status: 'MALWARE' }]
            }) as unknown as Response

            const results = await ExtensionsAnalyzer.analyze(['aikidosecurity.aikido-endpoint-test'])
            assert.strictEqual(results.length, 1)
            assert.strictEqual(results[0].extensionId, 'aikidosecurity.aikido-endpoint-test')
            assert.strictEqual(results[0].malicious, true)
        })

        test('marks luisfontes19.watchtower as non-malicious', async () => {
            global.fetch = async () => ({
                ok: true,
                json: async () => []
            }) as unknown as Response

            const results = await ExtensionsAnalyzer.analyze(['luisfontes19.watchtower'])
            assert.strictEqual(results.length, 1)
            assert.strictEqual(results[0].extensionId, 'luisfontes19.watchtower')
            assert.strictEqual(results[0].malicious, false)
        })

        test('processes multiple extensions and preserves order', async () => {
            global.fetch = async (url: string | URL | Request) => {
                const isMalicious = url.toString().includes('aikido-endpoint-test')
                return {
                    ok: true,
                    json: async () => isMalicious ? [{ status: 'MALWARE' }] : []
                } as unknown as Response
            }

            const results = await ExtensionsAnalyzer.analyze([
                'aikidosecurity.aikido-endpoint-test',
                'luisfontes19.watchtower'
            ])
            assert.strictEqual(results.length, 2)
            assert.strictEqual(results[0].extensionId, 'aikidosecurity.aikido-endpoint-test')
            assert.strictEqual(results[0].malicious, true)
            assert.strictEqual(results[1].extensionId, 'luisfontes19.watchtower')
            assert.strictEqual(results[1].malicious, false)
        })

        test('returns malicious false when fetch throws', async () => {
            global.fetch = async () => { throw new Error('Network error') }

            const results = await ExtensionsAnalyzer.analyze(['aikidosecurity.aikido-endpoint-test'])
            assert.strictEqual(results.length, 1)
            assert.strictEqual(results[0].malicious, false)
        })

        test('returns malicious false when response is not ok', async () => {
            global.fetch = async () => ({ ok: false, status: 503 }) as unknown as Response

            const results = await ExtensionsAnalyzer.analyze(['aikidosecurity.aikido-endpoint-test'])
            assert.strictEqual(results[0].malicious, false)
        })
    })
})
