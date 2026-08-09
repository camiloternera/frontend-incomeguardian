import { Routes } from '@angular/router';
import { LoginPageComponent } from './features/auth/login-page.component';
import { HomePageComponent } from './features/home/home-page.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginPageComponent },
  { path: 'home', component: HomePageComponent },
  { path: '**', redirectTo: 'login' },
];
