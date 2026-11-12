import { AfterViewInit, Component, ElementRef, Injector, Input, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import FuzzySearch from 'fuzzy-search'
import { Subscription } from 'rxjs'
import { AppService, BaseTabComponent, ConfigService, PartialProfile, Profile, ProfilesService } from 'tabby-core'
import { SettingsTabComponent } from 'tabby-settings'

import { FastfetchData, FastfetchService } from '../services/fastfetch.service'
import { IconsService, MaterialCardPalette } from '../services/icons.service'
import { PROFILE_SELECTOR_SETTINGS_TAB_ID } from '../settings'
import { ProfileEditModalComponent } from './profileEditModal.component'

export interface SelectorTileItem {
    raw: PartialProfile<Profile>
    name: string
    group: string
    iconHtml: string
    palette: MaterialCardPalette
}

/** @hidden */
@Component({
    selector: 'profile-selector',
    template: require('./profileSelector.component.html'),
    styles: [require('./profileSelector.component.scss')],
})
export class ProfileSelectorComponent extends BaseTabComponent implements OnInit, AfterViewInit, OnDestroy {
    @Input() search = ''
    @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>

    profiles: SelectorTileItem[] = []
    groups: string[] = []
    groupedProfiles: Record<string, SelectorTileItem[]> = {}
    loaded = false

    fastfetchData: FastfetchData | null = null
    fastfetchLoading = false

    private configSub?: Subscription

    constructor(
        public config: ConfigService,
        public profilesService: ProfilesService,
        private app: AppService,
        private iconsService: IconsService,
        private fastfetchService: FastfetchService,
        private ngbModal: NgbModal,
        injector: Injector,
    ) {
        super(injector)
        this.icon = 'fas fa-grip'
        this.title = 'Select Profile'
    }

    get fastfetchViewMode(): 'cards' | 'terminal' {
        return this.config.store.profileSelector?.fastfetchStyle === 'terminal' ? 'terminal' : 'cards'
    }

    async ngOnInit(): Promise<void> {
        this.ensurePluginConfig()
        void this.loadFastfetch(false)
        await this.reloadProfiles()
        this.loaded = true

        this.configSub = this.config.changed$.subscribe(() => {
            this.reloadProfiles()
            if (this.config.store.profileSelector?.showFastfetch !== false && !this.fastfetchData) {
                void this.loadFastfetch(false)
            }
        })
    }

    ngAfterViewInit(): void {
        this.focusSearch()
    }

    ngOnDestroy(): void {
        this.configSub?.unsubscribe()
        super.ngOnDestroy()
    }

    private ensurePluginConfig(): void {
        this.config.store.profileSelector ??= {
            showBuiltinProfiles: false,
            showImportedSshProfiles: false,
            showFastfetch: true,
            fastfetchStyle: 'cards',
        }
    }

    private focusSearch(): void {
        setTimeout(() => {
            this.searchInput?.nativeElement?.focus()
        }, 40)
    }

    private groupOrder(group: string): string {
        if (
            group === 'Favorites' ||
            group === 'Starred' ||
            group === 'Favourites' ||
            group === 'Favorite' ||
            group === 'Favourited'
        ) {
            return '0001'
        }
        if (group === 'Ungrouped') return 'ZZZX'
        if (group.startsWith('Imported ')) return 'ZZZY'
        if (group === 'Built-in') return 'ZZZZ'
        return group
    }

    private applyGrouping(items: SelectorTileItem[] = this.profiles): void {
        if (items.length === 0) {
            this.groups = []
            this.groupedProfiles = {}
            return
        }

        this.groups = Array.from(new Set(items.map(x => x.group).filter(Boolean))).sort((a, b) =>
            this.groupOrder(a).localeCompare(this.groupOrder(b)),
        )

        this.groupedProfiles = {}
        for (const group of this.groups) {
            this.groupedProfiles[group] = items.filter(x => x.group === group)
        }
    }

    async reloadProfiles(): Promise<void> {
        this.ensurePluginConfig()
        const showBuiltin = Boolean(this.config.store.profileSelector?.showBuiltinProfiles)
        const showImportedSsh = Boolean(this.config.store.profileSelector?.showImportedSshProfiles)
        const blacklist: string[] = this.config.store.profileBlacklist ?? []

        const allProfiles = await this.profilesService.getProfiles({ includeBuiltin: true, clone: true })
        const items: SelectorTileItem[] = []

        for (const rawProfile of allProfiles) {
            if (rawProfile.id === 'profile-selector' || rawProfile.type === 'profile-selector') {
                continue
            }
            if (rawProfile.isTemplate) {
                continue
            }
            if (rawProfile.id && blacklist.includes(rawProfile.id)) {
                continue
            }

            const isSshImport = this.iconsService.isImportedSshProfile(rawProfile)
            if (isSshImport && !showImportedSsh) {
                continue
            }
            if (!isSshImport && rawProfile.isBuiltin && !showBuiltin) {
                continue
            }

            const option = this.profilesService.selectorOptionForProfile(rawProfile)
            const mergedIcon = rawProfile.icon || option.icon || ''
            const mergedColor = rawProfile.color || option.color || ''
            const displayName = rawProfile.name || option.name || this.profilesService.getDescription(rawProfile) || 'Unnamed'

            let groupName = rawProfile.group ?? ''
            if (!groupName && rawProfile.isBuiltin) {
                groupName = 'Built-in'
            } else if (groupName) {
                groupName = this.profilesService.resolveProfileGroupName(groupName) || groupName
            } else {
                groupName = 'Ungrouped'
            }

            const profileWithVisuals: PartialProfile<Profile> = {
                ...rawProfile,
                name: displayName,
                icon: mergedIcon,
                color: mergedColor,
            }

            items.push({
                raw: rawProfile,
                name: displayName,
                group: groupName,
                iconHtml: this.iconsService.getIconHtml(profileWithVisuals),
                palette: this.iconsService.computeCardPalette(mergedColor, mergedIcon),
            })
        }

        items.sort((a, b) => {
            if (a.group === b.group) {
                return a.name.localeCompare(b.name)
            }
            return this.groupOrder(a.group).localeCompare(this.groupOrder(b.group))
        })

        this.profiles = items
        this.onSearchChange()
    }

    selectProfile(profile: PartialProfile<Profile>): void {
        this.profilesService.launchProfile(profile)
        this.destroy()
    }

    onSearchChange(): void {
        const q = this.search.trim().toLowerCase()
        if (!q) {
            this.applyGrouping(this.profiles)
            return
        }

        const matches = new FuzzySearch(this.profiles, ['name', 'group'], { sort: false }).search(q)
        this.applyGrouping(matches)
    }

    clearSearch(): void {
        this.search = ''
        this.onSearchChange()
        this.focusSearch()
    }

    onSearchKeydown(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            event.preventDefault()
            if (this.search) {
                this.clearSearch()
            } else {
                this.destroy()
            }
            return
        }

        if (event.key === 'Enter' && this.groups.length > 0) {
            const firstGroup = this.groups[0]
            const firstItem = this.groupedProfiles[firstGroup]?.[0]
            if (firstItem) {
                event.preventDefault()
                this.selectProfile(firstItem.raw)
            }
        }
    }

    async enableBuiltinQuickSetup(): Promise<void> {
        await this.toggleBuiltinVisibility(true)
        this.focusSearch()
    }

    async toggleBuiltinVisibility(visible: boolean): Promise<void> {
        this.ensurePluginConfig()
        this.config.store.profileSelector.showBuiltinProfiles = visible
        await this.config.save()
        await this.reloadProfiles()
    }

    async openCreateProfileModal(baseProfile?: PartialProfile<Profile>): Promise<void> {
        const modalRef = this.ngbModal.open(ProfileEditModalComponent, { size: 'lg', backdrop: 'static' })
        modalRef.componentInstance.mode = 'create'
        if (baseProfile) {
            modalRef.componentInstance.baseProfile = baseProfile
        }
        const saved = await modalRef.result.catch(() => null)
        if (saved) {
            await this.reloadProfiles()
            this.focusSearch()
        }
    }

    async openEditProfileModal(profile: PartialProfile<Profile>): Promise<void> {
        const modalRef = this.ngbModal.open(ProfileEditModalComponent, { size: 'lg', backdrop: 'static' })
        modalRef.componentInstance.mode = 'edit'
        modalRef.componentInstance.existingProfile = profile
        const saved = await modalRef.result.catch(() => null)
        if (saved) {
            await this.reloadProfiles()
            this.focusSearch()
        }
    }

    async onCardAction(event: MouseEvent, item: SelectorTileItem): Promise<void> {
        event.preventDefault()
        event.stopPropagation()
        if (item.raw.isBuiltin) {
            await this.openCreateProfileModal(item.raw)
        } else {
            await this.openEditProfileModal(item.raw)
        }
    }

    openPluginSettings(): void {
        this.app.openNewTabRaw({
            type: SettingsTabComponent,
            inputs: { activeTab: PROFILE_SELECTOR_SETTINGS_TAB_ID },
        })
    }

    async loadFastfetch(forceRefresh: boolean): Promise<void> {
        if (this.config.store.profileSelector?.showFastfetch === false) {
            return
        }
        this.fastfetchLoading = true
        try {
            this.fastfetchData = await this.fastfetchService.getFastfetchInfo(forceRefresh)
        } finally {
            this.fastfetchLoading = false
        }
    }

    async refreshFastfetch(): Promise<void> {
        await this.loadFastfetch(true)
    }

    async setFastfetchViewMode(mode: 'cards' | 'terminal'): Promise<void> {
        this.ensurePluginConfig()
        this.config.store.profileSelector.fastfetchStyle = mode
        await this.config.save()
    }
}