import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { HomePageComponent } from './presentation/pages/home/home-page.component';

export const dashboardRoutes: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('dashboard')],
    component: HomePageComponent,
  },
];
