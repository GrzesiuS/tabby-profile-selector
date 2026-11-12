import { Injectable } from '@angular/core'
import { ConfigProvider } from 'tabby-core'

@Injectable()
export class ProfileSelectorConfigProvider extends ConfigProvider {
    defaults = {
        profileSelector: {
            showBuiltinProfiles: false,
            showImportedSshProfiles: false,
            showFastfetch: true,
            fastfetchStyle: 'cards',
        },
    }

    platformDefaults = {}
}
