export enum FindingType {
    Task = "Suspicious Task",
    JsonSchema = "Suspicious JSON Schema",
    SilentFileChange = "Silent File Change",
    McpServer = "MCP Server Detected"
}

export interface Finding {
    type: FindingType,
    file?: string,
    name: string,
    detail: string,
    severity: 'low' | 'medium' | 'high'
}
