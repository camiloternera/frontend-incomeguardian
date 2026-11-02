import { TestBed } from '@angular/core/testing';
import { PasswordVisibilityIconComponent } from './password-visibility-icon.component';

describe('PasswordVisibilityIconComponent', () => {
  /** Renderiza el ícono con el estado de visibilidad indicado y devuelve su `<svg>`. */
  function render(visible: boolean): SVGElement {
    const fixture = TestBed.createComponent(PasswordVisibilityIconComponent);
    fixture.componentRef.setInput('visible', visible);
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('svg');
  }

  it('muestra el ojo abierto mientras la contraseña está oculta', () => {
    const svg = render(false);

    expect(svg.getAttribute('data-icon')).toBe('eye');
    expect(svg.querySelector('circle')).not.toBeNull();
  });

  it('muestra el ojo tachado cuando la contraseña está visible', () => {
    const svg = render(true);

    expect(svg.getAttribute('data-icon')).toBe('eye-off');
    expect(svg.querySelectorAll('path')).toHaveLength(4);
  });

  it('es decorativo y usa 18px por defecto', () => {
    const svg = render(false);

    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('width')).toBe('18');
    expect(svg.getAttribute('height')).toBe('18');
  });
});
