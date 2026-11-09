import { Injectable, inject, signal, untracked } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, Subject, tap } from 'rxjs';
import { GENERIC_ERROR_KEY } from '@core/http/api-error';
import {
  ClosePeriodUseCase,
  GetPendingPeriodUseCase,
  GetPeriodYearUseCase,
  ReopenPeriodUseCase,
} from '../application/period-use-cases';
import { PendingPeriod, PeriodMonth, PeriodRef, PeriodYear, RecloseMode, ReopenRequest } from '../domain/period';
import { PeriodError } from '../domain/period-error';

/** Estado de la consulta de un año. */
export type YearEntry =
  | { status: 'loading' }
  | { status: 'ready'; data: PeriodYear }
  | { status: 'error'; message: string };

/** Desde dónde se pidió reabrir: el formulario de un movimiento ofrece volver a él. */
export type ReopenOrigin = 'form' | 'selector';

export interface ReopenTarget {
  period: PeriodRef;
  origin: ReopenOrigin;
}

/** Aviso que confirma una reapertura. */
export interface ReopenNotice {
  period: PeriodRef;
  mode: RecloseMode | null;
  origin: ReopenOrigin;
}

/** Clave de localStorage del aviso pospuesto con «Más tarde»; guarda el período (`yyyy-MM`). */
const SNOOZE_KEY = 'ig.periods.snoozed';

function periodKey(period: { year: number; month: number }): string {
  return `${period.year}-${String(period.month).padStart(2, '0')}`;
}

function readSnooze(): string | null {
  try {
    return localStorage.getItem(SNOOZE_KEY);
  } catch {
    return null;
  }
}

function writeSnooze(value: string): void {
  try {
    localStorage.setItem(SNOOZE_KEY, value);
  } catch {
    // Sin almacenamiento el aviso se pospone solo mientras dure la sesión.
  }
}

/**
 * Estado del cierre de períodos que comparten el selector de mes, el aviso del Resumen, el panel de
 * cierre, el modal de reabrir y la nota de fecha cerrada de los formularios. Se provee con
 * `providePeriods()` en la ruta de cada vista que los usa.
 */
@Injectable()
export class PeriodWorkspace {
  private readonly getYear = inject(GetPeriodYearUseCase);
  private readonly getPending = inject(GetPendingPeriodUseCase);
  private readonly closePeriod = inject(ClosePeriodUseCase);
  private readonly reopenPeriod = inject(ReopenPeriodUseCase);
  private readonly transloco = inject(TranslocoService);
  private readonly changes = new Subject<PeriodRef>();
  private pendingRequested = false;

  /** Años consultados, por número de año. */
  readonly years = signal<Record<number, YearEntry>>({});
  /** Mes pendiente que recuerda el Resumen; `undefined` mientras no se conoce. */
  readonly pending = signal<PendingPeriod | null | undefined>(undefined);
  /** Período pospuesto con «Más tarde» (`yyyy-MM`). */
  readonly snoozed = signal<string | null>(readSnooze());

  /** Período abierto en el panel de cierre. */
  readonly closing = signal<PeriodRef | null>(null);
  /** Período que se está por reabrir en el modal. */
  readonly reopening = signal<ReopenTarget | null>(null);
  /** Confirmación de la última reapertura. */
  readonly notice = signal<ReopenNotice | null>(null);

  /** Emite cada vez que un período cambia de estado. */
  readonly changed$: Observable<PeriodRef> = this.changes.asObservable();

  /** Pide el estado del año si aún no se tiene (o siempre, con `force`). */
  loadYear(year: number, force = false): void {
    // Se lee sin rastrear para que un `effect` que pide un año no dependa de todos los años.
    const entry = untracked(this.years)[year];

    if (!force && entry && entry.status !== 'error') {
      return;
    }

    // Al recargar se conserva el dato anterior para no parpadear.
    if (entry?.status !== 'ready') {
      this.setYear(year, { status: 'loading' });
    }

    this.getYear.execute(year).subscribe({
      next: (data) => this.setYear(year, { status: 'ready', data }),
      error: (error: unknown) => this.setYear(year, { status: 'error', message: this.messageOf(error) }),
    });
  }

  /** Consulta el mes pendiente (una vez, o siempre con `force`). Si falla, el aviso no se muestra. */
  loadPending(force = false): void {
    if (this.pendingRequested && !force) {
      return;
    }

    this.pendingRequested = true;
    this.getPending.execute().subscribe({
      next: (pending) => this.pending.set(pending),
      error: () => this.pending.set(null),
    });
  }

  /** Si el aviso del mes pendiente está pospuesto. */
  isSnoozed(pending: PendingPeriod): boolean {
    return this.snoozed() === periodKey(pending);
  }

  snooze(pending: PendingPeriod): void {
    const key = periodKey(pending);
    this.snoozed.set(key);
    writeSnooze(key);
  }

  openClose(period: PeriodRef): void {
    this.closing.set(period);
  }

  openReopen(period: PeriodRef, origin: ReopenOrigin = 'selector'): void {
    this.reopening.set({ period, origin });
  }

  /** Cierra el período y actualiza todo lo que depende de él. */
  close(period: PeriodRef): Observable<PeriodMonth | PeriodYear> {
    return this.closePeriod.execute(period).pipe(
      tap({
        next: () => {
          // El aviso «está abierto» de ese período ya no es cierto.
          const notice = this.notice();

          if (notice && notice.period.year === period.year && notice.period.month === period.month) {
            this.notice.set(null);
          }

          this.refresh(period);
        },
      }),
    );
  }

  /** Reabre el período; con `announce` muestra el aviso de confirmación. */
  reopen(period: PeriodRef, request: ReopenRequest, origin: ReopenOrigin | null): Observable<PeriodMonth | PeriodYear> {
    return this.reopenPeriod.execute(period, request).pipe(
      tap({
        next: () => {
          this.refresh(period);

          if (origin) {
            this.notice.set({ period, mode: period.month === null ? null : (request.recloseMode ?? 'auto'), origin });
          }
        },
      }),
    );
  }

  /** Vuelve a consultar el año y el pendiente tras un cambio, y lo anuncia. */
  refresh(period: PeriodRef): void {
    this.loadYear(period.year, true);
    this.loadPending(true);
    this.changes.next(period);
  }

  private setYear(year: number, entry: YearEntry): void {
    this.years.update((years) => ({ ...years, [year]: entry }));
  }

  private messageOf(error: unknown): string {
    return error instanceof PeriodError ? error.message : this.transloco.translate(GENERIC_ERROR_KEY);
  }
}
