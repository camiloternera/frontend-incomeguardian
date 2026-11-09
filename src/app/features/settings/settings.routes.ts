import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { providePeriods } from '@features/periods';
import { provideSettings } from './settings.providers';
import { SettingsPageComponent } from './presentation/pages/settings/settings-page.component';

export const settingsRoutes: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('settings'), provideSettings(), providePeriods()],
    component: SettingsPageComponent,
  },
];
