import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface CashFlowBar {
  label: string;
  income: number;
  expenses: number;
}

interface Group {
  label: string;
  labelX: number;
  income: { x: number; y: number; height: number };
  expenses: { x: number; y: number; height: number };
}

interface GridLine {
  y: number;
  label: string;
  value: number;
}

const VIEW = { width: 820, height: 260, left: 52, top: 16, plotWidth: 748, plotHeight: 208 };
const BAR_WIDTH = 30;
const BASELINE = VIEW.top + VIEW.plotHeight;

/** Grouped bars for the last months. Plain inline SVG: no chart library. */
@Component({
  selector: 'app-cash-flow-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.viewBox]="'0 0 ' + view.width + ' ' + view.height"
      width="100%"
      height="240"
      role="img"
      [attr.aria-label]="chartLabel()"
    >
      @for (line of grid(); track line.value) {
        <line
          [attr.x1]="view.left"
          [attr.y1]="line.y"
          [attr.x2]="view.left + view.plotWidth"
          [attr.y2]="line.y"
          class="stroke-ig-border"
          stroke-width="1"
        />
        <text
          [attr.x]="view.left - 10"
          [attr.y]="line.y + 4"
          text-anchor="end"
          font-size="10"
          class="fill-ig-muted"
        >
          {{ line.label }}
        </text>
      }

      @for (group of groups(); track group.label) {
        <rect
          [attr.x]="group.income.x"
          [attr.y]="group.income.y"
          [attr.width]="barWidth"
          [attr.height]="group.income.height"
          rx="4"
          class="fill-ig-accent"
        />
        <rect
          [attr.x]="group.expenses.x"
          [attr.y]="group.expenses.y"
          [attr.width]="barWidth"
          [attr.height]="group.expenses.height"
          rx="4"
          class="fill-ig-muted"
        />
        <text
          [attr.x]="group.labelX"
          [attr.y]="baseline + 20"
          text-anchor="middle"
          font-size="11"
          class="fill-ig-muted"
        >
          {{ group.label }}
        </text>
      }

      <line
        [attr.x1]="view.left"
        [attr.y1]="baseline"
        [attr.x2]="view.left + view.plotWidth"
        [attr.y2]="baseline"
        class="stroke-ig-border"
        stroke-width="1"
      />
    </svg>
  `,
})
export class CashFlowChartComponent {
  readonly bars = input.required<CashFlowBar[]>();
  readonly chartLabel = input('');
  /** Formats a grid value, so the axis follows the active language. */
  readonly formatTick = input<(value: number) => string>((value) => String(value));

  protected readonly view = VIEW;
  protected readonly barWidth = BAR_WIDTH;
  protected readonly baseline = BASELINE;

  /** Rounds the top of the scale up so the tallest bar never touches the frame. */
  private readonly scaleMax = computed(() => {
    const peak = Math.max(...this.bars().flatMap((bar) => [bar.income, bar.expenses]), 0);
    const step = this.tickStep(peak);

    return Math.max(Math.ceil(peak / step) * step, step);
  });

  protected readonly grid = computed<GridLine[]>(() => {
    const max = this.scaleMax();
    const step = this.tickStep(max);
    const lines: GridLine[] = [];

    for (let value = 0; value <= max; value += step) {
      lines.push({ value, y: this.toY(value), label: this.formatTick()(value) });
    }

    return lines;
  });

  protected readonly groups = computed<Group[]>(() => {
    const bars = this.bars();

    if (bars.length === 0) {
      return [];
    }

    const groupWidth = VIEW.plotWidth / bars.length;

    return bars.map((bar, index) => {
      const center = VIEW.left + groupWidth * index + groupWidth / 2;

      return {
        label: bar.label,
        labelX: Math.round(center),
        income: this.toBar(Math.round(center - BAR_WIDTH - 4), bar.income),
        expenses: this.toBar(Math.round(center + 4), bar.expenses),
      };
    });
  });

  private toBar(x: number, value: number): Group['income'] {
    const height = Math.round((value / this.scaleMax()) * VIEW.plotHeight);

    return { x, y: BASELINE - height, height };
  }

  private toY(value: number): number {
    return BASELINE - Math.round((value / this.scaleMax()) * VIEW.plotHeight);
  }

  /** Keeps the axis at four or five readable steps whatever the amounts are. */
  private tickStep(peak: number): number {
    const rough = Math.max(peak, 1) / 4;
    const magnitude = 10 ** Math.floor(Math.log10(rough));
    const normalized = rough / magnitude;
    const step = normalized > 5 ? 10 : normalized > 2 ? 5 : normalized > 1 ? 2 : 1;

    return step * magnitude;
  }
}
