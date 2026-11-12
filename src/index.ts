import { NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { NgbModule } from '@ng-bootstrap/ng-bootstrap'
import TabbyCorePlugin, { ConfigProvider, ProfilesService, ProfileProvider } from 'tabby-core'
import { SettingsTabProvider } from 'tabby-settings'

import { ProfileSelectorConfigProvider } from './config'
import { ProfileEditModalComponent } from './components/profileEditModal.component'
import { ProfileSelectorComponent } from './components/profileSelector.component'
import { ProfileSelectorSettingsTabComponent } from './components/settingsTab.component'
import { ProfileSelectorProfilesService } from './profiles'
import { FastfetchService } from './services/fastfetch.service'
import { IconsService } from './services/icons.service'
import { ProfilesServicesOverride } from './services/profiles.service'
import { ProfileSelectorSettingsTabProvider } from './settings'

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        NgbModule,
        TabbyCorePlugin,
    ],
    providers: [
        IconsService,
        FastfetchService,
        { provide: ProfilesService, useClass: ProfilesServicesOverride },
        { provide: ProfileProvider, useClass: ProfileSelectorProfilesService, multi: true },
        { provide: ConfigProvider, useClass: ProfileSelectorConfigProvider, multi: true },
        { provide: SettingsTabProvider, useClass: ProfileSelectorSettingsTabProvider, multi: true },
    ],
    declarations: [
        ProfileSelectorComponent,
        ProfileEditModalComponent,
        ProfileSelectorSettingsTabComponent,
    ],
})
export default class ProfileSelectorPlugin {}