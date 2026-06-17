import * as vscode from 'vscode'
import { Finding, FindingType } from '../types'
import { AgentsAnalyzer } from './agentsFile'

export abstract class StaticAnalyzer {

    async runBackgroundEditedCheck(uri: vscode.Uri): Promise<Finding[]> {
        const findings: Finding[] = []

        if (this.alertOnEditedInBackground() && this.editedInBackground(uri)) {

            let detail = `A file that is deemed sensitive was modified while not being the active editor tab, this indicates that it was edited by some kind of background process, since it's consider a sensitive file it is recommended to investigate this change to make sure it was legitimate`
            let priority = "low"

            if (AgentsAnalyzer.isAgentFile(uri)) {
                detail += ` The file ${vscode.workspace.asRelativePath(uri)} is an AI related file, which may indicate an attack against AI agents.`
                priority = "high"
            }
            findings.push({
                type: FindingType.SilentFileChange,
                name: `Sensitive file ${vscode.workspace.asRelativePath(uri)} edited in the background`,
                detail,
                priority: priority as any,
                file: vscode.workspace.asRelativePath(uri, false)
            })

        }
        return findings

    }


    // Checks a file for findings
    abstract checkFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]>

    // If the provided uri is to be scanned by this analyzer
    abstract canScanFile(uri: vscode.Uri): boolean

    // if the file was edited in the background
    abstract alertOnEditedInBackground(): boolean

    editedInBackground(uri: vscode.Uri): boolean {
        const activeEditor = vscode.window.activeTextEditor
        return !activeEditor || activeEditor.document.uri.fsPath !== uri.fsPath
    }

    protected async ensureFileContent(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Uint8Array> {
        if (content)
            return Promise.resolve(content)
        else
            return await vscode.workspace.fs.readFile(uri)

    }

    protected parentFolderRelativePath(uri: vscode.Uri): string {
        const parent = vscode.Uri.joinPath(uri, '..')
        return vscode.workspace.asRelativePath(parent, false)
    }

    protected isNotBinaryFile(file: vscode.Uri): boolean {
        const ext = file.fsPath.split('.').pop()?.toLowerCase()
        return !this.ignoreExtensions().includes(ext!)
    }

    protected ignoreExtensions() {
        return [
            // Images (raster)
            "jpg", "jpeg", "png", "gif", "bmp", "webp", "tiff", "tif", "ico",
            "heic", "heif", "avif", "jxl", "jp2", "j2k", "jpx",
            // Images (camera raw)
            "raw", "cr2", "cr3", "nef", "nrw", "arw", "srf", "sr2", "dng",
            "orf", "rw2", "pef", "raf", "3fr", "mrw", "x3f", "erf",
            // Images (design)
            "psd", "psb", "ai", "eps", "xcf", "sketch", "fig", "xd",

            // Video
            "mp4", "mkv", "avi", "mov", "wmv", "flv", "webm", "m4v", "mpg", "mpeg",
            "3gp", "3g2", "ogv", "m2ts", "vob", "rmvb", "rm", "asf",
            "f4v", "divx", "mxf", "roq",

            // Audio
            "mp3", "wav", "ogg", "flac", "aac", "m4a", "wma", "opus", "aiff", "aif",
            "mid", "midi", "ape", "mka", "dts", "ac3", "amr", "au", "ra", "caf",
            "dsf", "dff", "wv", "tak",

            // Executables & Binaries
            "exe", "dll", "so", "dylib", "lib", "a", "o", "obj", "bin", "elf", "out",
            "com", "sys", "drv", "ko", "axf", "prx", "mod", "xbe", "xex",
            // Scripts that are often pre-compiled or opaque blobs
            "msi", "msix", "appx",

            // Archives & Compressed
            "zip", "tar", "gz", "bz2", "xz", "7z", "rar", "lz4", "zst", "br", "lzma",
            "lz", "lzo", "z", "tgz", "tbz2", "txz", "tlz", "tzst",
            "cab", "iso", "img", "dmg", "pkg", "deb", "rpm", "apk", "ipa",
            "jar", "war", "ear", "aar", "nupkg", "vsix", "crx", "xpi",

            // Fonts
            "ttf", "otf", "woff", "woff2", "eot", "fon", "pfb", "pfm",

            // Documents & Office
            "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
            "odt", "ods", "odp", "odg", "odf",
            "pages", "numbers", "key",
            "xps", "oxps",

            // Database & Data files
            "db", "sqlite", "sqlite3", "db3", "mdb", "accdb", "ldb", "sdf",
            "fdb", "gdb", "frm", "ibd", "myd",

            // Compiled / bytecode
            "pyc", "pyo", "pyd", "class", "wasm",
            "luac", "rbc", "elc", "beam", "escript",
            "dex", "odex", "vdex", "art",

            // Node / native addons
            "node",

            // Certificates & keystores (binary formats)
            "der", "p12", "pfx", "jks", "bks", "p7b", "p7c",

            // Virtual machine & firmware images
            "vmdk", "vhd", "vhdx", "qcow", "qcow2", "vdi", "ova", "ovf",
            "rom", "bios", "efi", "fw", "hex", "ihex",

            // 3D / CAD
            "stl", "obj", "fbx", "dae", "3ds", "blend", "c4d", "max",
            "glb", "gltf",

            // ML models & large data blobs
            "gguf", "ggml", "pt", "pth", "onnx", "pb", "h5", "hdf5",
            "safetensors", "npy", "npz",
            "parquet", "arrow", "feather", "orc", "avro",
            "pkl", "pickle",

            // Compiled shaders & GPU
            "spv", "cso", "metallib", "dxbc", "dxil",

            // Debug & profiling artifacts
            "pdb", "profraw", "profdata", "gcda", "gcno",

            // Game assets & engines
            "pak", "wad", "bsp", "vpk", "unitypackage", "bundle", "swf",

            // Compiled resources & platform assets
            "mo", "icns", "res", "cur", "ani", "mui",

            // Compiler & linker artifacts
            "bc", "rlib", "rmeta", "pch", "gch", "ifc",

            // Geospatial / GIS
            "shp", "shx", "gpkg", "mbtiles", "geotiff",

            // Scientific / research data
            "mat", "rda", "rdata", "rds", "fits", "nc",

            // Cryptographic & password stores
            "gpg", "pgp", "kdbx",

            // Mobile & platform packages
            "aab", "xcarchive",

            // Serialized binary data
            "dat", "marshal", "nib",
        ]
    }
}
