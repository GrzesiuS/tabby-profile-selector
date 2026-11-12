import { Component, OnDestroy, OnInit } from '@angular/core'
import { NgbModal } from '@ng-bootstrap/ng-bootstrap'
import { Subscription } from 'rxjs'
import { ConfigService, PartialProfile, PlatformService, Profile, ProfilesService } from 'tabby-core'

import { IconsService, MaterialCardPalette } from '../services/icons.service'
import { ProfileEditModalComponent } from './profileEditModal.component'

interface UserProfileViewItem {
    profile: PartialProfile<Profile>
    groupName: string
    iconHtml: string
    palette: MaterialCardPalette
}

@Component({
    selector: 'profile-selector-settings-tab',
    template: require('./settingsTab.component.html'),
    styles: [require('./settingsTab.component.scss')],
})
export class ProfileSelectorSettingsTabComponent implements OnInit, OnDestroy {
    userProfiles: UserProfileViewItem[] = []
    private configSub?: Subscription

    constructor(
        public config: ConfigService,
        private profilesService: ProfilesService,
        private iconsService: IconsService,
        private ngbModal: NgbModal,
        private platform: PlatformService,
    ) {}

    async ngOnInit(): Promise<void> {
        this.ensureConfigObject()
        await this.reloadUserProfiles()
        this.configSub = this.config.changed$.subscribe(() => {
            this.reloadUserProfiles()
        })
    }

    ngOnDestroy(): void {
        this.configSub?.unsubscribe()
    }

    private ensureConfigObject(): void {
        this.config.store.profileSelector ??= {
            showBuiltinProfiles: false,
            showImportedSshProfiles: false,
            showFastfetch: true,
            fastfetchStyle: 'cards',
        }
    }

    async setShowBuiltin(value: boolean): Promise<void> {
        this.ensureConfigObject()
        this.config.store.profileSelector.showBuiltinProfiles = value
        await this.config.save()
    }

    async setShowImportedSsh(value: boolean): Promise<void> {
        this.ensureConfigObject()
        this.config.store.profileSelector.showImportedSshProfiles = value
        await this.config.save()
    }

    async setShowFastfetch(value: boolean): Promise<void> {
        this.ensureConfigObject()
        this.config.store.profileSelector.showFastfetch = value
        await this.config.save()
    }

    async reloadUserProfiles(): Promise<void> {
        const rawProfiles = (this.config.store.profiles ?? []).filter(
            (p: PartialProfile<Profile>) => !p.isBuiltin && !p.isTemplate,
        )

        this.userProfiles = rawProfiles.map((p: PartialProfile<Profile>) => ({
            profile: p,
            groupName: p.group ? this.profilesService.resolveProfileGroupName(p.group) : '',
            iconHtml: this.iconsService.getIconHtml(p),
            palette: this.iconsService.computeCardPalette(p.color, p.icon),
        }))
    }

    async createNewProfile(): Promise<void> {
        const modalRef = this.ngbModal.open(ProfileEditModalComponent, { size: 'lg', backdrop: 'static' })
        modalRef.componentInstance.mode = 'create'
        const saved = await modalRef.result.catch(() => null)
        if (saved) {
            await this.reloadUserProfiles()
        }
    }

    async editProfile(profile: PartialProfile<Profile>): Promise<void> {
        const modalRef = this.ngbModal.open(ProfileEditModalComponent, { size: 'lg', backdrop: 'static' })
        modalRef.componentInstance.mode = 'edit'
        modalRef.componentInstance.existingProfile = profile
        const saved = await modalRef.result.catch(() => null)
        if (saved) {
            await this.reloadUserProfiles()
        }
    }

    async deleteProfile(profile: PartialProfile<Profile>): Promise<void> {
        const res = await this.platform.showMessageBox({
            type: 'warning',
            message: `Usunąć profil „${profile.name}”?`,
            buttons: ['Usuń', 'Anuluj'],
            defaultId: 1,
            cancelId: 1,
        })
        if (res.response === 0) {
            await this.profilesService.deleteProfile(profile)
            await this.config.save()
            await this.reloadUserProfiles()
        }
    }
}
