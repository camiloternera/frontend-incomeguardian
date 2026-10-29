import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { provideDashboard } from './dashboard.providers';
import { HomePageComponent } from './presentation/pages/home/home-page.component';

export const dashboardRoutes: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('dashboard'), provideDashboard()],
    component: HomePageComponent,
  },
];
