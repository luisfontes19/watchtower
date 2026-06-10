import { Settings } from './settings'
import type { Finding } from './types'

type RuleMethod = (...args: any[]) => Finding[]

export interface RuleDefinition {
    id: string
    description: string
}

export class RuleRegistry {
    private static rules = new Map<string, RuleDefinition>()

    static register(id: string, description: string): void {
        RuleRegistry.rules.set(id, { id, description })
    }

    static isEnabled(ruleId: string): boolean {
        const disabled = Settings.getInstance().getAllDisabledRules()
        return !disabled.includes(ruleId)
    }

    static getAllRules(): RuleDefinition[] {
        return Array.from(RuleRegistry.rules.values())
    }

    static getAllRuleIds(): string[] {
        return Array.from(RuleRegistry.rules.keys())
    }
}

/**
 * Method decorator that registers a rule and skips execution when the rule is disabled.
 * Decorated methods must return Finding[] (sync). The decorator returns [] when the rule is disabled.
 */
export function rule(ruleId: string, description: string) {
    RuleRegistry.register(ruleId, description)

    return function <T extends RuleMethod>(
        _target: object,
        _propertyKey: string | symbol,
        descriptor: TypedPropertyDescriptor<T>
    ): TypedPropertyDescriptor<T> {
        const original = descriptor.value
        if (!original)
            return descriptor

        descriptor.value = function (this: unknown, ...args: Parameters<T>): Finding[] {
            if (!RuleRegistry.isEnabled(ruleId)) {
                return []
            }
            const findings = original.apply(this, args)
            if (!Array.isArray(findings)) {
                throw new TypeError(`Rule '${ruleId}' method must return Finding[]`)
            }
            return findings
        } as T

        return descriptor
    }
}
