import Chart from "react-apexcharts";
import type { ApexAxisChartSeries, ApexOptions } from "apexcharts";

interface BarChartProps {
  chartData: ApexAxisChartSeries;
  chartOptions: ApexOptions;
}

const BarChart = ({ chartData, chartOptions }: BarChartProps) => {
  return (
    <Chart
      options={chartOptions}
      series={chartData}
      type="bar"
      width="100%"
      height="100%"
    />
  );
};

export default BarChart;
