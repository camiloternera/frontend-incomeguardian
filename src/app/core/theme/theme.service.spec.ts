import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    TestBed.configureTestingModule({});
  });

  it('starts on Forest and applies it to the document', () => {
    const service = TestBed.inject(ThemeService);
    TestBed.tick();

    expect(service.theme()).toBe('forest');
    expect(document.documentElement.dataset['theme']).toBe('forest');
  });

  it('applies and persists a theme change', () => {
    const service = TestBed.inject(ThemeService);
    service.setTheme('noir');
    TestBed.tick();

    expect(document.documentElement.dataset['theme']).toBe('noir');
    expect(localStorage.getItem('income-guardian.theme')).toBe('noir');
  });

  it('restores the stored theme and ignores an unknown one', () => {
    localStorage.setItem('income-guardian.theme', 'paper');
    expect(TestBed.inject(ThemeService).theme()).toBe('paper');

    localStorage.setItem('income-guardian.theme', 'chartreuse');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});

    expect(TestBed.inject(ThemeService).theme()).toBe('forest');
  });
});
