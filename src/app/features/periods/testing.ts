/**
 * API de pruebas del cierre de períodos. Los specs de otros dominios (Resumen, Movimientos, Ajustes)
 * la importan como `@features/periods/testing` para no llegar al backend; el código de la app nunca.
 */
export {
  FakePeriodRepository,
  periodMonth,
  periodYear,
  provideFakePeriods,
  sampleYear,
} from './presentation/period-repository.fake';
