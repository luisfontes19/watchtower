export enum FindingType {
    Task = "Suspicious Task",
    JsonSchema = "Suspicious JSON Schema",
    SilentFileChange = "Silent File Change",
    McpServer = "MCP Server Detected",
    BinaryChange = "Binary Change",
}

export interface Finding {
    type: FindingType,
    file: string,
    name: string,
    detail: string,
    priority: 'low' | 'medium' | 'high'
}
