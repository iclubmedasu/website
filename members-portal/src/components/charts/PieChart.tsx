import Chart from "react-apexcharts";
import type { ApexNonAxisChartSeries, ApexOptions } from "apexcharts";

interface PieChartProps {
  series: ApexNonAxisChartSeries;
  options: ApexOptions;
}

const PieChart = ({ series, options }: PieChartProps) => {

  return (
    <Chart
      options={options}
      type="pie"
      width="100%"
      height="100%"
      series={series}
    />
  );
};

export default PieChart;
