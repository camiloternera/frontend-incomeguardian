import { Component } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

@Component({
  selector: 'app-home-page',
  imports: [TranslocoDirective],
  template: `<main *transloco="let t; prefix: 'dashboard.home'" data-testid="home-page" [attr.aria-label]="t('label')"></main>`,
})
export class HomePageComponent {}
