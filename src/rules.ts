import * as vscode from 'vscode'
import { Settings } from './settings'

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

    return function (
        _target: object,
        _propertyKey: string | symbol,
        descriptor: PropertyDescriptor
    ) {
        const original = descriptor.value
        descriptor.value = function (...args: any[]) {
            if (!RuleRegistry.isEnabled(ruleId)) {
                return []
            }
            return original.apply(this, args)
        }
        return descriptor
    }
}
