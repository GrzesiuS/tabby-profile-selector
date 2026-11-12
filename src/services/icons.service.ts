import { Injectable } from '@angular/core'
import * as simpleIcons from 'simple-icons'
import type { SimpleIcon } from 'simple-icons'
import { PartialProfile, Profile } from 'tabby-core'

export interface SimpleIconItem {
    title: string
    slug: string
    hex: string
    path: string
    searchText: string
}

export interface RgbColor {
    r: number
    g: number
    b: number
}

export interface MaterialCardPalette {
    hasCustomColor: boolean
    accentColor: string
    cardBg: string
    cardBgHover: string
    cardBorder: string
    cardBorderHover: string
    iconBg: string
    iconFg: string
}

const FEATURED_SLUGS: string[] = [
    'ubuntu',
    'debian',
    'archlinux',
    'fedora',
    'redhat',
    'almalinux',
    'rockylinux',
    'alpinelinux',
    'kali',
    'nixos',
    'freebsd',
    'linux',
    'docker',
    'kubernetes',
    'podman',
    'proxmox',
    'ansible',
    'terraform',
    'gnubash',
    'zsh',
    'fishshell',
    'windowsterminal',
    'apple',
    'git',
    'github',
    'gitlab',
    'bitbucket',
    'googlecloud',
    'cloudflare',
    'digitalocean',
    'hetzner',
    'ovh',
    'tailscale',
    'wireguard',
    'openvpn',
    'nginx',
    'apache',
    'caddy',
    'traefikproxy',
    'postgresql',
    'mysql',
    'mariadb',
    'redis',
    'mongodb',
    'sqlite',
    'python',
    'nodedotjs',
    'rust',
    'go',
    'dotnet',
    'openjdk',
    'php',
    'ruby',
    'raspberrypi',
    'arduino',
    'homeassistant',
    'grafana',
    'prometheus',
]

const NAMED_CSS_COLORS: Record<string, string> = {
    aqua: '#00ffff',
    blue: '#0000ff',
    blueviolet: '#8a2be2',
    coral: '#ff7f50',
    cornflowerblue: '#6495ed',
    crimson: '#dc143c',
    cyan: '#00ffff',
    darkblue: '#00008b',
    darkcyan: '#008b8b',
    darkgoldenrod: '#b8860b',
    darkgreen: '#006400',
    darkmagenta: '#8b008b',
    darkorange: '#ff8c00',
    darkorchid: '#9932cc',
    darkred: '#8b0000',
    darkturquoise: '#00ced1',
    darkviolet: '#9400d3',
    deeppink: '#ff1493',
    deepskyblue: '#00bfff',
    dodgerblue: '#1e90ff',
    firebrick: '#b22222',
    forestgreen: '#228b22',
    fuchsia: '#ff00ff',
    gold: '#ffd700',
    goldenrod: '#daa520',
    green: '#008000',
    hotpink: '#ff69b4',
    indianred: '#cd5c5c',
    indigo: '#4b0082',
    limegreen: '#32cd32',
    magenta: '#ff00ff',
    maroon: '#800000',
    mediumblue: '#0000cd',
    mediumorchid: '#ba55d3',
    mediumpurple: '#9370db',
    mediumseagreen: '#3cb371',
    mediumslateblue: '#7b68ee',
    mediumspringgreen: '#00fa9a',
    mediumturquoise: '#48d1cc',
    mediumvioletred: '#c71585',
    midnightblue: '#191970',
    navy: '#000080',
    olive: '#808000',
    orange: '#ffa500',
    orangered: '#ff4500',
    orchid: '#da70d6',
    peru: '#cd853f',
    plum: '#dda0dd',
    purple: '#800080',
    rebeccapurple: '#663399',
    red: '#ff0000',
    royalblue: '#4169e1',
    saddlebrown: '#8b4513',
    salmon: '#fa8072',
    seagreen: '#2e8b57',
    sienna: '#a0522d',
    skyblue: '#87ceeb',
    slateblue: '#6a5acd',
    springgreen: '#00ff7f',
    steelblue: '#4682b4',
    teal: '#008080',
    tomato: '#ff6347',
    turquoise: '#40e0d0',
    violet: '#ee82ee',
    yellow: '#ffff00',
    yellowgreen: '#9acd32',
}

export const MATERIAL_COLOR_PRESETS: { name: string, value: string }[] = [
    { name: 'Blue', value: '#2563eb' },
    { name: 'Sky', value: '#0284c7' },
    { name: 'Cyan', value: '#0891b2' },
    { name: 'Teal', value: '#0d9488' },
    { name: 'Emerald', value: '#059669' },
    { name: 'Green', value: '#16a34a' },
    { name: 'Amber', value: '#d97706' },
    { name: 'Orange', value: '#ea580c' },
    { name: 'Red', value: '#dc2626' },
    { name: 'Rose', value: '#e11d48' },
    { name: 'Pink', value: '#db2777' },
    { name: 'Purple', value: '#9333ea' },
    { name: 'Violet', value: '#7c3aed' },
    { name: 'Indigo', value: '#4f46e5' },
    { name: 'Slate', value: '#475569' },
]

@Injectable({ providedIn: 'root' })
export class IconsService {
    private catalog: SimpleIconItem[] | null = null
    private featuredCatalog: SimpleIconItem[] | null = null

    getAllSimpleIcons(): SimpleIconItem[] {
        if (this.catalog) {
            return this.catalog
        }

        const items: SimpleIconItem[] = []
        const seen = new Set<string>()
        const mod = simpleIcons as Record<string, unknown>

        for (const key of Object.keys(mod)) {
            if (!key.startsWith('si')) {
                continue
            }
            const icon = mod[key] as SimpleIcon | undefined
            if (!icon || typeof icon !== 'object' || !icon.slug || !icon.path || seen.has(icon.slug)) {
                continue
            }
            seen.add(icon.slug)
            items.push({
                title: icon.title,
                slug: icon.slug,
                hex: `#${icon.hex}`,
                path: icon.path,
                searchText: `${icon.title.toLowerCase()} ${icon.slug.toLowerCase()}`,
            })
        }

        items.sort((a, b) => a.title.localeCompare(b.title))
        this.catalog = items
        return items
    }

    searchSimpleIcons(query: string, limit = 60): SimpleIconItem[] {
        const all = this.getAllSimpleIcons()
        const q = (query ?? '').trim().toLowerCase()

        if (!q) {
            if (!this.featuredCatalog) {
                const bySlug = new Map(all.map(i => [i.slug, i]))
                const featured: SimpleIconItem[] = []
                for (const slug of FEATURED_SLUGS) {
                    const found = bySlug.get(slug)
                    if (found) {
                        featured.push(found)
                    }
                }
                for (const icon of all) {
                    if (featured.length >= limit) {
                        break
                    }
                    if (!FEATURED_SLUGS.includes(icon.slug)) {
                        featured.push(icon)
                    }
                }
                this.featuredCatalog = featured
            }
            return this.featuredCatalog.slice(0, limit)
        }

        const exact: SimpleIconItem[] = []
        const startsWith: SimpleIconItem[] = []
        const contains: SimpleIconItem[] = []

        for (const icon of all) {
            const titleLower = icon.title.toLowerCase()
            const slugLower = icon.slug.toLowerCase()
            if (titleLower === q || slugLower === q) {
                exact.push(icon)
            } else if (titleLower.startsWith(q) || slugLower.startsWith(q)) {
                startsWith.push(icon)
            } else if (icon.searchText.includes(q)) {
                contains.push(icon)
            }
        }

        return [...exact, ...startsWith, ...contains].slice(0, limit)
    }

    findSimpleIconBySvg(iconMarkup?: string): SimpleIconItem | null {
        if (!iconMarkup || !iconMarkup.startsWith('<')) {
            return null
        }
        const slugMatch = iconMarkup.match(/data-simple-icon="([^"]+)"/i)
        if (slugMatch?.[1]) {
            return this.getAllSimpleIcons().find(x => x.slug === slugMatch[1]) ?? null
        }
        const pathMatch = iconMarkup.match(/<path[^>]*\sd="([^"]+)"/i)
        if (pathMatch?.[1] && !this.hasCustomColorsInSvg(iconMarkup)) {
            return this.getAllSimpleIcons().find(x => x.path === pathMatch[1]) ?? null
        }
        return null
    }

    toSimpleIconSvg(icon: SimpleIconItem): string {
        return `<svg role="img" viewBox="0 0 24 24" fill="currentColor" data-simple-icon="${icon.slug}" xmlns="http://www.w3.org/2000/svg"><path d="${icon.path}"/></svg>`
    }

    isSimpleIconSvg(iconMarkup?: string): boolean {
        if (!iconMarkup) {
            return false
        }
        return /data-simple-icon="[^"]+"/i.test(iconMarkup)
    }

    sanitizeSvg(rawInput: string): string | null {
        if (!rawInput) {
            return null
        }
        const cleaned = rawInput
            .replace(/<\?xml[\s\S]*?\?>/gi, '')
            .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
            .replace(/<!--[\s\S]*?-->/g, '')
            .trim()

        const match = cleaned.match(/<svg[\s\S]*<\/svg>/i)
        if (!match) {
            return null
        }

        let svg = match[0]
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
            .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
            .replace(/javascript\s*:/gi, '')

        const openTagMatch = svg.match(/^<svg\b([^>]*)>/i)
        if (openTagMatch) {
            let attrs = openTagMatch[1]
            if (!/\bxmlns\s*=/i.test(attrs)) {
                attrs += ' xmlns="http://www.w3.org/2000/svg"'
            }
            if (!/\bviewBox\s*=/i.test(attrs)) {
                const wMatch = attrs.match(/\bwidth\s*=\s*["']?(\d+(?:\.\d+)?)/i)
                const hMatch = attrs.match(/\bheight\s*=\s*["']?(\d+(?:\.\d+)?)/i)
                if (wMatch && hMatch) {
                    attrs += ` viewBox="0 0 ${wMatch[1]} ${hMatch[1]}"`
                }
            }
            svg = svg.replace(/^<svg\b[^>]*>/i, `<svg${attrs}>`)
        }

        return svg
    }

    /**
     * Extracts a primary/dominant color solely from a custom colored SVG icon.
     * Returns null for Simple Icons or uncolored/monochrome SVGs.
     */
    extractColorFromCustomSvg(svgMarkup: string): string | null {
        if (!svgMarkup || this.isSimpleIconSvg(svgMarkup)) {
            return null
        }

        const rawTokens: string[] = []

        const attrRegex = /\b(?:fill|stroke|stop-color|flood-color)\s*=\s*["']([^"']+)["']/gi
        let match: RegExpExecArray | null
        while ((match = attrRegex.exec(svgMarkup)) !== null) {
            rawTokens.push(match[1].trim())
        }

        const stylePropRegex = /(?:fill|stroke|stop-color|flood-color)\s*:\s*([^;}"']+)/gi
        while ((match = stylePropRegex.exec(svgMarkup)) !== null) {
            rawTokens.push(match[1].trim())
        }

        const colorCounts = new Map<string, { rgb: RgbColor, count: number, saturation: number, lightness: number }>()

        for (const token of rawTokens) {
            const lower = token.toLowerCase().replace(/\s*!important\s*$/, '').trim()
            if (
                !lower ||
                lower === 'none' ||
                lower === 'transparent' ||
                lower === 'currentcolor' ||
                lower === 'inherit' ||
                lower === 'initial' ||
                lower === 'unset' ||
                lower.startsWith('url(') ||
                lower.startsWith('var(')
            ) {
                continue
            }

            const rgb = this.parseColor(lower)
            if (!rgb) {
                continue
            }

            const hex = this.rgbToHex(rgb)
            const { s, l } = this.rgbToHsl(rgb)

            // Ignore pure/near black and pure/near white outlines or backgrounds
            if (l < 0.06 || l > 0.95) {
                continue
            }

            const existing = colorCounts.get(hex)
            if (existing) {
                existing.count += 1
            } else {
                colorCounts.set(hex, { rgb, count: 1, saturation: s, lightness: l })
            }
        }

        if (colorCounts.size === 0) {
            return null
        }

        let bestHex: string | null = null
        let bestScore = -1

        for (const [hex, entry] of colorCounts.entries()) {
            const vibrancyBonus = entry.saturation >= 0.15 ? 2.5 : 0.6
            const midtoneBonus = 1 - Math.abs(entry.lightness - 0.5)
            const score = entry.count * vibrancyBonus * (0.5 + midtoneBonus)
            if (score > bestScore) {
                bestScore = score
                bestHex = hex
            }
        }

        return bestHex
    }

    hasCustomColorsInSvg(iconMarkup?: string): boolean {
        if (!iconMarkup || !iconMarkup.trim().startsWith('<svg') || this.isSimpleIconSvg(iconMarkup)) {
            return false
        }
        return this.extractColorFromCustomSvg(iconMarkup) !== null
    }

    getIconHtml(profile: PartialProfile<Profile>): string {
        const icon = profile.icon?.trim()
        if (!icon) {
            return '<i class="fas fa-terminal"></i>'
        }
        if (icon.startsWith('<')) {
            return icon
        }
        if (icon.startsWith('data:') || icon.startsWith('http://') || icon.startsWith('https://')) {
            return `<img src="${icon}" alt="" />`
        }
        const faClass = /^(fas|far|fab|fal|fad|fa)\s/.test(icon)
            ? icon
            : icon.startsWith('fa-')
                ? `fas ${icon}`
                : `fas fa-${icon}`
        return `<i class="${faClass}"></i>`
    }

    parseColor(color?: string | null): RgbColor | null {
        if (!color) {
            return null
        }
        const trimmed = color.trim().toLowerCase()
        if (!trimmed) {
            return null
        }

        if (NAMED_CSS_COLORS[trimmed]) {
            return this.parseColor(NAMED_CSS_COLORS[trimmed])
        }

        if (trimmed.startsWith('#')) {
            const hex = trimmed.slice(1)
            if (hex.length === 3 || hex.length === 4) {
                const r = parseInt(hex[0] + hex[0], 16)
                const g = parseInt(hex[1] + hex[1], 16)
                const b = parseInt(hex[2] + hex[2], 16)
                if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
                    return { r, g, b }
                }
            } else if (hex.length === 6 || hex.length === 8) {
                const r = parseInt(hex.slice(0, 2), 16)
                const g = parseInt(hex.slice(2, 4), 16)
                const b = parseInt(hex.slice(4, 6), 16)
                if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
                    return { r, g, b }
                }
            }
            return null
        }

        const rgbMatch = trimmed.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i)
        if (rgbMatch) {
            return {
                r: Math.min(255, Math.max(0, parseInt(rgbMatch[1], 10))),
                g: Math.min(255, Math.max(0, parseInt(rgbMatch[2], 10))),
                b: Math.min(255, Math.max(0, parseInt(rgbMatch[3], 10))),
            }
        }

        const hslMatch = trimmed.match(/^hsla?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%/i)
        if (hslMatch) {
            const h = (parseFloat(hslMatch[1]) % 360) / 360
            const s = Math.min(100, Math.max(0, parseFloat(hslMatch[2]))) / 100
            const l = Math.min(100, Math.max(0, parseFloat(hslMatch[3]))) / 100
            return this.hslToRgb(h, s, l)
        }

        return null
    }

    rgbToHex(rgb: RgbColor): string {
        const toHex = (n: number) => Math.min(255, Math.max(0, Math.round(n))).toString(16).padStart(2, '0')
        return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`
    }

    normalizeHexColor(color?: string | null): string {
        const rgb = this.parseColor(color)
        return rgb ? this.rgbToHex(rgb) : '#2563eb'
    }

    computeCardPalette(color?: string | null, iconMarkup?: string | null): MaterialCardPalette {
        const rgb = this.parseColor(color)
        const isColoredCustomSvg = this.hasCustomColorsInSvg(iconMarkup ?? undefined)

        if (!rgb) {
            return {
                hasCustomColor: false,
                accentColor: 'var(--theme-primary, #3b82f6)',
                cardBg: 'rgba(128, 128, 128, 0.08)',
                cardBgHover: 'rgba(128, 128, 128, 0.15)',
                cardBorder: 'rgba(128, 128, 128, 0.2)',
                cardBorderHover: 'rgba(128, 128, 128, 0.38)',
                iconBg: 'rgba(128, 128, 128, 0.16)',
                iconFg: 'currentColor',
            }
        }

        const { r, g, b } = rgb
        const hex = this.rgbToHex(rgb)
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
        const contrastFg = luminance > 0.62 ? '#111827' : '#ffffff'

        return {
            hasCustomColor: true,
            accentColor: hex,
            cardBg: `rgba(${r}, ${g}, ${b}, 0.10)`,
            cardBgHover: `rgba(${r}, ${g}, ${b}, 0.18)`,
            cardBorder: `rgba(${r}, ${g}, ${b}, 0.34)`,
            cardBorderHover: `rgba(${r}, ${g}, ${b}, 0.65)`,
            iconBg: isColoredCustomSvg ? `rgba(${r}, ${g}, ${b}, 0.18)` : hex,
            iconFg: isColoredCustomSvg ? 'inherit' : contrastFg,
        }
    }

    isImportedSshProfile(profile: PartialProfile<Profile>): boolean {
        const group = (profile.group ?? '').trim()
        return (
            group === 'Imported from .ssh/config' ||
            group.startsWith('Imported ') ||
            Boolean(profile.id?.startsWith('ssh:imported:')) ||
            Boolean(profile.name?.endsWith('(.ssh/config)'))
        )
    }

    private rgbToHsl({ r, g, b }: RgbColor): { h: number, s: number, l: number } {
        const rn = r / 255
        const gn = g / 255
        const bn = b / 255
        const max = Math.max(rn, gn, bn)
        const min = Math.min(rn, gn, bn)
        const l = (max + min) / 2
        let h = 0
        let s = 0

        if (max !== min) {
            const d = max - min
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
            switch (max) {
                case rn:
                    h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
                    break
                case gn:
                    h = ((bn - rn) / d + 2) / 6
                    break
                case bn:
                    h = ((rn - gn) / d + 4) / 6
                    break
            }
        }
        return { h, s, l }
    }

    private hslToRgb(h: number, s: number, l: number): RgbColor {
        if (s === 0) {
            const v = Math.round(l * 255)
            return { r: v, g: v, b: v }
        }
        const hue2rgb = (p: number, q: number, t: number) => {
            let tn = t
            if (tn < 0) tn += 1
            if (tn > 1) tn -= 1
            if (tn < 1 / 6) return p + (q - p) * 6 * tn
            if (tn < 1 / 2) return q
            if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6
            return p
        }
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s
        const p = 2 * l - q
        return {
            r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
            g: Math.round(hue2rgb(p, q, h) * 255),
            b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
        }
    }
}
