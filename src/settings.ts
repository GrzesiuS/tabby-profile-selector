import { Injectable } from '@angular/core'
import { SettingsTabProvider } from 'tabby-settings'
import { ProfileSelectorSettingsTabComponent } from './components/settingsTab.component'

export const PROFILE_SELECTOR_SETTINGS_TAB_ID = 'profile-selector'

@Injectable()
export class ProfileSelectorSettingsTabProvider extends SettingsTabProvider {
    id = PROFILE_SELECTOR_SETTINGS_TAB_ID
    icon = 'fas fa-grip'
    title = 'Profile Selector'

    getComponentType(): any {
        return ProfileSelectorSettingsTabComponent
    }
}
