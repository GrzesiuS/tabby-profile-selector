import { Injectable } from '@angular/core'
import * as cp from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

export interface FastfetchSpecItem {
    key: string
    valueHtml: string
    icon: string
}

export interface FastfetchData {
    status: 'ready' | 'missing' | 'error'
    binaryPath?: string
    titleHtml?: string
    logoHtml?: string
    rawHtml?: string
    items?: FastfetchSpecItem[]
    paletteColors?: string[]
    errorMessage?: string
    fetchedAt?: number
}

const ANSI_FG_PALETTE: Record<number, string> = {
    30: '#475569',
    31: '#ef4444',
    32: '#22c55e',
    33: '#f59e0b',
    34: '#3b82f6',
    35: '#a855f7',
    36: '#06b6d4',
    37: '#e2e8f0',
    90: '#64748b',
    91: '#f87171',
    92: '#4ade80',
    93: '#fbbf24',
    94: '#60a5fa',
    95: '#c084fc',
    96: '#22d3ee',
    97: '#f8fafc',
}

const ANSI_BG_PALETTE: Record<number, string> = {
    40: '#1e293b',
    41: '#dc2626',
    42: '#16a34a',
    43: '#d97706',
    44: '#2563eb',
    45: '#9333ea',
    46: '#0891b2',
    47: '#cbd5e1',
    100: '#475569',
    101: '#f87171',
    102: '#4ade80',
    103: '#fbbf24',
    104: '#60a5fa',
    105: '#c084fc',
    106: '#22d3ee',
    107: '#f8fafc',
}

@Injectable({ providedIn: 'root' })
export class FastfetchService {
    private resolvedBinaryPath: string | null | undefined = undefined
    private cachedData: FastfetchData | null = null
    private readonly cacheTtlMs = 30_000

    async getFastfetchInfo(forceRefresh = false): Promise<FastfetchData> {
        if (!forceRefresh && this.cachedData && this.cachedData.fetchedAt) {
            if (Date.now() - this.cachedData.fetchedAt < this.cacheTtlMs) {
                return this.cachedData
            }
        }

        if (forceRefresh) {
            this.resolvedBinaryPath = undefined
        }

        const bin = this.findFastfetchBinary()
        if (!bin) {
            const missing: FastfetchData = { status: 'missing', fetchedAt: Date.now() }
            this.cachedData = missing
            return missing
        }

        try {
            const [rawOut, logoOut, infoOut] = await Promise.all([
                this.execFastfetch(bin, ['--pipe', 'false']),
                this.execFastfetch(bin, ['--pipe', 'false', '-s', 'none']).catch(() => ''),
                this.execFastfetch(bin, ['--pipe', 'false', '--logo', 'none']).catch(() => ''),
            ])

            const parsed = this.parseOutputs(bin, rawOut, logoOut, infoOut)
            this.cachedData = parsed
            return parsed
        } catch (err: unknown) {
            // If binary execution failed with ENOENT, treat as missing
            const code = (err as { code?: string })?.code
            if (code === 'ENOENT') {
                this.resolvedBinaryPath = null
                const missing: FastfetchData = { status: 'missing', fetchedAt: Date.now() }
                this.cachedData = missing
                return missing
            }

            const errResult: FastfetchData = {
                status: 'error',
                binaryPath: bin,
                errorMessage: err instanceof Error ? err.message : String(err),
                fetchedAt: Date.now(),
            }
            this.cachedData = errResult
            return errResult
        }
    }

    findFastfetchBinary(): string | null {
        if (this.resolvedBinaryPath !== undefined) {
            return this.resolvedBinaryPath
        }

        const isWin = process.platform === 'win32'
        const exeNames = isWin ? ['fastfetch.exe', 'fastfetch.cmd'] : ['fastfetch']

        const pathDirs = (process.env.PATH ?? '')
            .split(path.delimiter)
            .map(p => p.trim().replace(/^"|"$/g, ''))
            .filter(Boolean)

        for (const dir of pathDirs) {
            for (const exe of exeNames) {
                const full = path.join(dir, exe)
                if (this.isFile(full)) {
                    this.resolvedBinaryPath = full
                    return full
                }
            }
        }

        const candidates: string[] = []
        const home = os.homedir()

        if (isWin) {
            const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local')
            const programFiles = process.env.ProgramFiles || 'C:\\Program Files'
            const programData = process.env.ProgramData || 'C:\\ProgramData'

            candidates.push(
                path.join(localAppData, 'Microsoft', 'WinGet', 'Links', 'fastfetch.exe'),
                path.join(home, 'scoop', 'shims', 'fastfetch.exe'),
                path.join(home, 'scoop', 'apps', 'fastfetch', 'current', 'fastfetch.exe'),
                path.join(programData, 'chocolatey', 'bin', 'fastfetch.exe'),
                path.join(programFiles, 'fastfetch', 'fastfetch.exe'),
                'C:\\msys64\\ucrt64\\bin\\fastfetch.exe',
                'C:\\msys64\\mingw64\\bin\\fastfetch.exe',
            )

            const wingetPkgs = path.join(localAppData, 'Microsoft', 'WinGet', 'Packages')
            if (this.isDirectory(wingetPkgs)) {
                try {
                    const pkgDirs = fs.readdirSync(wingetPkgs).filter(d => d.toLowerCase().includes('fastfetch'))
                    for (const pkgDir of pkgDirs) {
                        const pkgFull = path.join(wingetPkgs, pkgDir)
                        candidates.push(path.join(pkgFull, 'fastfetch.exe'))
                        if (this.isDirectory(pkgFull)) {
                            for (const sub of fs.readdirSync(pkgFull)) {
                                candidates.push(path.join(pkgFull, sub, 'fastfetch.exe'))
                            }
                        }
                    }
                } catch {
                    // Ignore unreadable directories
                }
            }
        } else {
            candidates.push(
                '/opt/homebrew/bin/fastfetch',
                '/usr/local/bin/fastfetch',
                '/usr/bin/fastfetch',
                '/bin/fastfetch',
                '/snap/bin/fastfetch',
                '/home/linuxbrew/.linuxbrew/bin/fastfetch',
                path.join(home, '.linuxbrew', 'bin', 'fastfetch'),
                path.join(home, '.local', 'bin', 'fastfetch'),
                path.join(home, '.cargo', 'bin', 'fastfetch'),
            )
        }

        for (const candidate of candidates) {
            if (this.isFile(candidate)) {
                this.resolvedBinaryPath = candidate
                return candidate
            }
        }

        this.resolvedBinaryPath = null
        return null
    }

    private execFastfetch(bin: string, args: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            cp.execFile(
                bin,
                args,
                {
                    encoding: 'utf8',
                    timeout: 6000,
                    maxBuffer: 2 * 1024 * 1024,
                    windowsHide: true,
                    env: {
                        ...process.env,
                        FORCE_COLOR: '1',
                    },
                },
                (error, stdout) => {
                    if (error && !stdout) {
                        reject(error)
                        return
                    }
                    resolve(stdout ?? '')
                },
            )
        })
    }

    parseOutputs(binaryPath: string, rawOut: string, logoOut: string, infoOut: string): FastfetchData {
        const cleanedRaw = this.trimEmptyTrailingLines(rawOut)
        const cleanedLogo = this.trimEmptyTrailingLines(logoOut)
        const rawHtml = this.ansiToHtml(cleanedRaw)
        const logoHtml = cleanedLogo ? this.ansiToHtml(cleanedLogo) : ''

        let titleHtml = ''
        const items: FastfetchSpecItem[] = []
        const paletteColors: string[] = []

        const infoLines = (infoOut || '').replace(/\r\n/g, '\n').split('\n')
        for (const rawLine of infoLines) {
            const plain = this.stripAnsi(rawLine).trim()
            if (!plain) {
                // Check if line consists of ANSI background color blocks (palette bar)
                const bgMatches = this.extractPaletteSwatches(rawLine)
                if (bgMatches.length > 0) {
                    for (const c of bgMatches) {
                        if (!paletteColors.includes(c)) {
                            paletteColors.push(c)
                        }
                    }
                }
                continue
            }

            // Skip dashed separator line under user@host
            if (/^[-─═]{3,}$/.test(plain)) {
                continue
            }

            if (!titleHtml && plain.includes('@') && !plain.includes(': ')) {
                titleHtml = this.ansiToHtml(rawLine.trim())
                continue
            }

            const colonIdx = plain.indexOf(': ')
            if (colonIdx > 0) {
                const key = plain.slice(0, colonIdx).trim()
                // Hide artificial parent process entries caused by invoking fastfetch from Electron
                if (key === 'Shell' && /\b(node|electron)\b/i.test(plain.slice(colonIdx + 2))) {
                    continue
                }
                const valueAnsi = this.sliceAnsiAfterColon(rawLine)
                items.push({
                    key,
                    valueHtml: this.ansiToHtml(valueAnsi),
                    icon: this.iconForKey(key),
                })
            } else if (!titleHtml) {
                titleHtml = this.ansiToHtml(rawLine.trim())
            }
        }

        if (paletteColors.length === 0) {
            for (const line of cleanedRaw.replace(/\r\n/g, '\n').split('\n')) {
                for (const c of this.extractPaletteSwatches(line)) {
                    if (!paletteColors.includes(c)) {
                        paletteColors.push(c)
                    }
                }
            }
        }

        return {
            status: 'ready',
            binaryPath,
            titleHtml,
            logoHtml,
            rawHtml,
            items,
            paletteColors,
            fetchedAt: Date.now(),
        }
    }

    ansiToHtml(input: string): string {
        if (!input) {
            return ''
        }

        const normalized = input
            .replace(/\r\n/g, '\n')
            // Strip non-SGR CSI control sequences (cursor moves, clear line, etc.)
            .replace(/\x1b\[[0-9;?]*[A-LN-Za-ln-z]/g, '')
            // Strip OSC sequences
            .replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, '')

        let fg: string | null = null
        let bg: string | null = null
        let bold = false
        let dim = false

        let html = ''
        let spanOpen = false

        const closeSpan = () => {
            if (spanOpen) {
                html += '</span>'
                spanOpen = false
            }
        }

        const openSpanIfNeeded = () => {
            const styles: string[] = []
            if (fg) styles.push(`color:${fg}`)
            if (bg) styles.push(`background-color:${bg};border-radius:2px`)
            if (bold) styles.push('font-weight:600')
            if (dim) styles.push('opacity:0.7')
            if (styles.length > 0) {
                html += `<span style="${styles.join(';')}">`
                spanOpen = true
            }
        }

        const sgrRegex = /\x1b\[([0-9;]*)m/g
        let lastIdx = 0
        let match: RegExpExecArray | null = sgrRegex.exec(normalized)

        while (match !== null) {
            const chunk = normalized.slice(lastIdx, match.index)
            if (chunk) {
                html += this.escapeHtml(chunk)
            }

            closeSpan()

            const rawCodes = match[1] === '' ? [0] : match[1].split(';').map(x => (x === '' ? 0 : parseInt(x, 10)))
            let i = 0
            while (i < rawCodes.length) {
                const code = rawCodes[i]
                if (code === 0) {
                    fg = null
                    bg = null
                    bold = false
                    dim = false
                } else if (code === 1) {
                    bold = true
                } else if (code === 2) {
                    dim = true
                } else if (code === 22) {
                    bold = false
                    dim = false
                } else if (code === 39) {
                    fg = null
                } else if (code === 49) {
                    bg = null
                } else if (ANSI_FG_PALETTE[code]) {
                    fg = ANSI_FG_PALETTE[code]
                } else if (ANSI_BG_PALETTE[code]) {
                    bg = ANSI_BG_PALETTE[code]
                } else if ((code === 38 || code === 48) && rawCodes[i + 1] === 2 && i + 4 < rawCodes.length) {
                    const r = Math.min(255, Math.max(0, rawCodes[i + 2] || 0))
                    const g = Math.min(255, Math.max(0, rawCodes[i + 3] || 0))
                    const b = Math.min(255, Math.max(0, rawCodes[i + 4] || 0))
                    const rgbStr = `rgb(${r},${g},${b})`
                    if (code === 38) fg = rgbStr
                    else bg = rgbStr
                    i += 4
                } else if ((code === 38 || code === 48) && rawCodes[i + 1] === 5 && i + 2 < rawCodes.length) {
                    const color256 = this.ansi256ToHex(rawCodes[i + 2] || 0)
                    if (code === 38) fg = color256
                    else bg = color256
                    i += 2
                }
                i++
            }

            openSpanIfNeeded()
            lastIdx = sgrRegex.lastIndex
            match = sgrRegex.exec(normalized)
        }

        const tail = normalized.slice(lastIdx)
        if (tail) {
            html += this.escapeHtml(tail)
        }
        closeSpan()

        return html
    }

    private stripAnsi(str: string): string {
        return str
            .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
            .replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, '')
    }

    private sliceAnsiAfterColon(rawLine: string): string {
        // Locate first ': ' outside ANSI escape sequences
        let inEsc = false
        for (let i = 0; i < rawLine.length - 1; i++) {
            const ch = rawLine[i]
            if (ch === '\x1b' && rawLine[i + 1] === '[') {
                inEsc = true
                continue
            }
            if (inEsc) {
                if ((ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z')) {
                    inEsc = false
                }
                continue
            }
            if (ch === ':' && rawLine[i + 1] === ' ') {
                return rawLine.slice(i + 2).trim()
            }
        }
        return rawLine.trim()
    }

    private extractPaletteSwatches(rawLine: string): string[] {
        const found: string[] = []
        const regex = /\x1b\[(4[0-7]|10[0-7])m\s+/g
        let m: RegExpExecArray | null = regex.exec(rawLine)
        while (m !== null) {
            const code = parseInt(m[1], 10)
            const hex = ANSI_BG_PALETTE[code]
            if (hex) {
                found.push(hex)
            }
            m = regex.exec(rawLine)
        }
        return found
    }

    private iconForKey(key: string): string {
        const k = key.toLowerCase()
        if (k === 'os') return 'fas fa-desktop'
        if (k.startsWith('host')) return 'fas fa-laptop'
        if (k.startsWith('kernel')) return 'fas fa-cogs'
        if (k.startsWith('uptime')) return 'fas fa-clock'
        if (k.startsWith('packages')) return 'fas fa-box-open'
        if (k.startsWith('shell')) return 'fas fa-terminal'
        if (k.startsWith('display') || k.startsWith('monitor')) return 'fas fa-tv'
        if (k.startsWith('de') || k.startsWith('wm') || k.startsWith('window manager')) return 'fas fa-window-maximize'
        if (k.startsWith('theme') || k.startsWith('icons') || k.startsWith('cursor') || k.startsWith('font')) return 'fas fa-palette'
        if (k.startsWith('terminal')) return 'fas fa-terminal'
        if (k.startsWith('cpu')) return 'fas fa-microchip'
        if (k.startsWith('gpu')) return 'fas fa-bolt'
        if (k.startsWith('memory') || k.startsWith('swap')) return 'fas fa-memory'
        if (k.startsWith('disk')) return 'fas fa-hdd'
        if (k.includes('ip') || k.startsWith('wifi') || k.startsWith('network')) return 'fas fa-network-wired'
        if (k.startsWith('battery') || k.startsWith('power')) return 'fas fa-battery-three-quarters'
        if (k.startsWith('locale')) return 'fas fa-globe'
        return 'fas fa-info-circle'
    }

    private ansi256ToHex(n: number): string {
        if (n < 8) return ANSI_FG_PALETTE[30 + n] || '#e2e8f0'
        if (n < 16) return ANSI_FG_PALETTE[90 + (n - 8)] || '#f8fafc'
        if (n >= 232) {
            const v = Math.min(255, Math.max(0, 8 + (n - 232) * 10))
            const h = v.toString(16).padStart(2, '0')
            return `#${h}${h}${h}`
        }
        const idx = n - 16
        const r = Math.floor(idx / 36)
        const g = Math.floor((idx % 36) / 6)
        const b = idx % 6
        const map = [0, 95, 135, 175, 215, 255]
        const toHex = (c: number) => map[c].toString(16).padStart(2, '0')
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`
    }

    private trimEmptyTrailingLines(text: string): string {
        const lines = (text || '').replace(/\r\n/g, '\n').split('\n')
        while (lines.length > 0 && !this.stripAnsi(lines[lines.length - 1]).trim() && !/\x1b\[(4[0-7]|10[0-7])m/.test(lines[lines.length - 1])) {
            lines.pop()
        }
        return lines.join('\n')
    }

    private escapeHtml(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
    }

    private isFile(p: string): boolean {
        try {
            return fs.existsSync(p) && fs.statSync(p).isFile()
        } catch {
            return false
        }
    }

    private isDirectory(p: string): boolean {
        try {
            return fs.existsSync(p) && fs.statSync(p).isDirectory()
        } catch {
            return false
        }
    }
}
