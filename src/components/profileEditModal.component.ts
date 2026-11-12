import { Component, Input, OnInit } from '@angular/core'
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap'
import {
    ConfigService,
    PartialProfile,
    PartialProfileGroup,
    Profile,
    ProfileGroup,
    ProfilesService,
} from 'tabby-core'
import * as tabbySettings from 'tabby-settings'

import {
    IconsService,
    MATERIAL_COLOR_PRESETS,
    MaterialCardPalette,
    SimpleIconItem,
} from '../services/icons.service'

interface BaseProfileChoice {
    label: string
    profile: PartialProfile<Profile>
}

@Component({
    selector: 'profile-selector-edit-modal',
    template: require('./profileEditModal.component.html'),
    styles: [require('./profileEditModal.component.scss')],
})
export class ProfileEditModalComponent implements OnInit {
    @Input() mode: 'create' | 'edit' = 'create'
    @Input() baseProfile?: PartialProfile<Profile>
    @Input() existingProfile?: PartialProfile<Profile>

    availableBaseProfiles: BaseProfileChoice[] = []
    selectedBaseIndex = 0

    existingGroups: PartialProfileGroup<ProfileGroup>[] = []
    selectedGroupId = ''
    newGroupName = ''

    draftName = ''
    draftIcon = ''
    draftColor = ''
    private nameTouched = false

    iconTab: 'simple' | 'svg' | 'fa' = 'simple'
    simpleIconQuery = ''
    filteredSimpleIcons: SimpleIconItem[] = []
    selectedSimpleSlug: string | null = null

    customSvgInput = ''
    svgError = ''
    autoColorNotice = ''

    faIconInput = ''
    readonly popularFaIcons = [
        { icon: 'fas fa-terminal', label: 'Terminal' },
        { icon: 'fas fa-server', label: 'Server' },
        { icon: 'fas fa-code', label: 'Code' },
        { icon: 'fas fa-database', label: 'Database' },
        { icon: 'fas fa-cloud', label: 'Cloud' },
        { icon: 'fas fa-network-wired', label: 'Network' },
        { icon: 'fas fa-shield-alt', label: 'Security' },
        { icon: 'fas fa-laptop-code', label: 'Dev' },
        { icon: 'fas fa-cube', label: 'Container' },
        { icon: 'fas fa-microchip', label: 'Hardware' },
        { icon: 'fas fa-key', label: 'SSH Key' },
        { icon: 'fas fa-globe', label: 'Remote' },
    ]

    readonly colorPresets = MATERIAL_COLOR_PRESETS
    saving = false

    private workingDraft: PartialProfile<Profile> = {
        name: '',
        type: 'local',
        options: {},
    }

    constructor(
        public activeModal: NgbActiveModal,
        private ngbModal: NgbModal,
        private config: ConfigService,
        private profilesService: ProfilesService,
        public iconsService: IconsService,
    ) {}

    get previewPalette(): MaterialCardPalette {
        return this.iconsService.computeCardPalette(this.draftColor, this.draftIcon)
    }

    get previewIconHtml(): string {
        return this.iconsService.getIconHtml({
            name: this.draftName,
            icon: this.draftIcon,
        } as PartialProfile<Profile>)
    }

    get colorPickerHex(): string {
        return this.iconsService.normalizeHexColor(this.draftColor)
    }

    get canSave(): boolean {
        if (!this.draftName.trim()) {
            return false
        }
        if (this.mode === 'create' && !this.workingDraft.type) {
            return false
        }
        if (this.selectedGroupId === '__new__' && !this.newGroupName.trim()) {
            return false
        }
        return true
    }

    get canOpenNativeAdvancedModal(): boolean {
        const editModalType = (tabbySettings as Record<string, unknown>).EditProfileModalComponent
        return Boolean(editModalType && this.workingDraft.type && this.profilesService.providerForProfile(this.workingDraft))
    }

    async ngOnInit(): Promise<void> {
        this.existingGroups = this.profilesService.getSyncProfileGroups()
        this.updateSimpleIconResults()

        if (this.mode === 'edit' && this.existingProfile) {
            this.workingDraft = this.cloneProfile(this.existingProfile)
            this.draftName = this.workingDraft.name ?? ''
            this.draftIcon = this.workingDraft.icon ?? ''
            this.draftColor = this.workingDraft.color ?? ''
            this.selectedGroupId = this.workingDraft.group ?? ''
            this.nameTouched = true
            this.initIconTabFromIcon(this.draftIcon)
            return
        }

        await this.loadBaseBuiltinProfiles()
    }

    private async loadBaseBuiltinProfiles(): Promise<void> {
        const all = await this.profilesService.getProfiles({ includeBuiltin: true, clone: true })
        const showSshImports = Boolean(this.config.store.profileSelector?.showImportedSshProfiles)

        const candidates = all.filter(p => {
            if (!p.isBuiltin) {
                return false
            }
            if (p.id === 'profile-selector' || p.type === 'profile-selector') {
                return false
            }
            if (!showSshImports && this.iconsService.isImportedSshProfile(p)) {
                return false
            }
            return true
        })

        this.availableBaseProfiles = candidates.map(p => {
            const desc = this.profilesService.getDescription(p)
            const suffix = p.isTemplate ? ' (Szablon)' : desc ? ` — ${desc}` : ''
            return {
                label: `${p.name || 'Unnamed'}${suffix}`,
                profile: p,
            }
        })

        if (this.baseProfile) {
            const matchIdx = this.availableBaseProfiles.findIndex(
                x => (this.baseProfile?.id && x.profile.id === this.baseProfile.id) || x.profile.name === this.baseProfile?.name,
            )
            if (matchIdx >= 0) {
                this.selectedBaseIndex = matchIdx
            } else {
                this.availableBaseProfiles.unshift({
                    label: this.baseProfile.name || 'Wybrany profil bazowy',
                    profile: this.cloneProfile(this.baseProfile),
                })
                this.selectedBaseIndex = 0
            }
        }

        if (this.availableBaseProfiles.length > 0) {
            this.applyBaseProfile(this.availableBaseProfiles[this.selectedBaseIndex].profile)
        }
    }

    onBaseProfileChange(index: number): void {
        this.selectedBaseIndex = Number(index)
        const chosen = this.availableBaseProfiles[this.selectedBaseIndex]
        if (chosen) {
            this.applyBaseProfile(chosen.profile)
        }
    }

    private applyBaseProfile(base: PartialProfile<Profile>): void {
        const cloned = this.cloneProfile(base)
        delete cloned.id
        cloned.isBuiltin = false
        cloned.isTemplate = false

        this.workingDraft = {
            ...cloned,
            icon: this.draftIcon || cloned.icon || '',
            color: this.draftColor || cloned.color || '',
        }

        if (!this.nameTouched || !this.draftName.trim()) {
            this.draftName = base.isTemplate ? '' : (base.name ?? '')
        }
        if (!this.draftIcon && cloned.icon) {
            this.draftIcon = cloned.icon
            this.initIconTabFromIcon(this.draftIcon)
        }
    }

    private initIconTabFromIcon(icon: string): void {
        if (!icon) {
            this.iconTab = 'simple'
            return
        }
        const matchedSimple = this.iconsService.findSimpleIconBySvg(icon)
        if (matchedSimple) {
            this.iconTab = 'simple'
            this.selectedSimpleSlug = matchedSimple.slug
            return
        }
        if (icon.trim().startsWith('<')) {
            this.iconTab = 'svg'
            this.customSvgInput = icon
            return
        }
        this.iconTab = 'fa'
        this.faIconInput = icon
    }

    onNameInput(): void {
        this.nameTouched = true
    }

    setIconTab(tab: 'simple' | 'svg' | 'fa'): void {
        this.iconTab = tab
    }

    updateSimpleIconResults(): void {
        this.filteredSimpleIcons = this.iconsService.searchSimpleIcons(this.simpleIconQuery, 60)
    }

    getSimpleIconPreviewSvg(item: SimpleIconItem): string {
        return `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="${item.path}"/></svg>`
    }

    selectSimpleIcon(item: SimpleIconItem): void {
        this.selectedSimpleSlug = item.slug
        this.draftIcon = this.iconsService.toSimpleIconSvg(item)
        this.autoColorNotice = ''
        this.svgError = ''
    }

    onCustomSvgChange(raw: string): void {
        this.svgError = ''
        this.autoColorNotice = ''
        this.selectedSimpleSlug = null

        const trimmed = (raw ?? '').trim()
        if (!trimmed) {
            return
        }

        const sanitized = this.iconsService.sanitizeSvg(trimmed)
        if (!sanitized) {
            this.svgError = 'Nie znaleziono poprawnego znacznika <svg>...</svg>.'
            return
        }

        this.draftIcon = sanitized

        const extractedColor = this.iconsService.extractColorFromCustomSvg(sanitized)
        if (extractedColor) {
            this.draftColor = extractedColor
            this.autoColorNotice = extractedColor
        }
    }

    onSvgFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement | null
        const file = input?.files?.[0]
        if (!file) {
            return
        }

        const reader = new FileReader()
        reader.onload = () => {
            const text = typeof reader.result === 'string' ? reader.result : ''
            this.customSvgInput = text
            this.onCustomSvgChange(text)
        }
        reader.readAsText(file)
        input.value = ''
    }

    onFaIconChange(value: string): void {
        this.selectedSimpleSlug = null
        this.autoColorNotice = ''
        this.draftIcon = value.trim()
    }

    selectFaIcon(iconClass: string): void {
        this.faIconInput = iconClass
        this.onFaIconChange(iconClass)
    }

    onUserColorPick(hex: string): void {
        this.draftColor = hex
        this.autoColorNotice = ''
    }

    onManualColorInput(): void {
        this.autoColorNotice = ''
    }

    clearColor(): void {
        this.draftColor = ''
        this.autoColorNotice = ''
    }

    async openAdvancedSettings(): Promise<void> {
        const EditProfileModalComponent = (tabbySettings as Record<string, any>).EditProfileModalComponent
        const provider = this.profilesService.providerForProfile(this.workingDraft)
        if (!EditProfileModalComponent || !provider) {
            return
        }

        this.syncFieldsIntoWorkingDraft()
        const savedIcon = this.draftIcon
        const savedColor = this.draftColor

        const modalRef = this.ngbModal.open(EditProfileModalComponent, { size: 'lg' })
        modalRef.componentInstance.partialProfile = this.cloneProfile(this.workingDraft)
        modalRef.componentInstance.profileProvider = provider

        const updated = await modalRef.result.catch(() => null)
        if (updated) {
            updated.type = provider.id
            this.workingDraft = this.cloneProfile(updated)
            this.draftName = updated.name || this.draftName
            this.draftIcon = updated.icon || savedIcon
            this.draftColor = updated.color ?? savedColor
            this.selectedGroupId = updated.group ?? this.selectedGroupId
            this.initIconTabFromIcon(this.draftIcon)
        }
    }

    private syncFieldsIntoWorkingDraft(): void {
        this.workingDraft.name = this.draftName.trim()
        this.workingDraft.icon = this.draftIcon.trim()
        this.workingDraft.color = this.draftColor.trim()
        this.workingDraft.isBuiltin = false
        this.workingDraft.isTemplate = false
    }

    async save(): Promise<void> {
        if (!this.canSave || this.saving) {
            return
        }

        this.saving = true
        try {
            let targetGroupId = this.selectedGroupId
            if (targetGroupId === '__new__') {
                const groupObj: PartialProfileGroup<ProfileGroup> = {
                    id: '',
                    name: this.newGroupName.trim(),
                }
                await this.profilesService.newProfileGroup(groupObj)
                targetGroupId = groupObj.id ?? ''
            }

            this.syncFieldsIntoWorkingDraft()
            if (targetGroupId) {
                this.workingDraft.group = targetGroupId
            } else {
                delete this.workingDraft.group
            }

            if (this.mode === 'edit' && this.workingDraft.id) {
                await this.profilesService.writeProfile(this.workingDraft)
            } else {
                delete this.workingDraft.id
                await this.profilesService.newProfile(this.workingDraft)
            }

            await this.config.save()
            this.activeModal.close(this.workingDraft)
        } finally {
            this.saving = false
        }
    }

    cancel(): void {
        this.activeModal.dismiss()
    }

    private cloneProfile(profile: PartialProfile<Profile>): PartialProfile<Profile> {
        return JSON.parse(JSON.stringify(profile))
    }
}
