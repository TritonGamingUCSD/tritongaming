import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart, HeatmapChart, FunnelChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, VisualMapComponent, CalendarComponent, MarkLineComponent, AriaComponent, GraphicComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { LabelLayout } from 'echarts/features';

// Only the parts of ECharts the portal uses are registered, so the bundle stays small. This file is loaded on demand by EChart.tsx (never on the server).
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  HeatmapChart,
  FunnelChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  VisualMapComponent,
  CalendarComponent,
  MarkLineComponent,
  AriaComponent,
  GraphicComponent,
  CanvasRenderer,
  LabelLayout,
]);

export default echarts;
