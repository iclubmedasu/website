import Chart from "react-apexcharts";
import type { ApexAxisChartSeries, ApexOptions } from "apexcharts";

interface LineChartProps {
  series: ApexAxisChartSeries;
  options: ApexOptions;
}

const LineChart = ({ series, options }: LineChartProps) => {

  return (
    <Chart
      options={options}
      type="line"
      width="100%"
      height="100%"
      series={series}
    />
  );
};

export default LineChart;
