'use client';

import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type {
    FinanceBalancePoint,
    FinanceCategoryBreakdownPoint,
    FinanceIncomeExpensePoint,
} from '@iclub/shared';

interface FinanceChartsSectionProps {
    balanceOverTime: FinanceBalancePoint[];
    incomeVsExpenseByMonth: FinanceIncomeExpensePoint[];
    expenseByCategory: FinanceCategoryBreakdownPoint[];
    currency: string;
}

const CHART_COLORS = ['#561789', '#16a34a', '#2563eb', '#ea580c', '#7c3aed', '#0891b2'];
const PURPLE = '#561789';
const GREEN = '#16a34a';

function formatAxis(value: number): string {
    if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return String(value);
}

export default function FinanceChartsSection({
    balanceOverTime,
    incomeVsExpenseByMonth,
    expenseByCategory,
}: FinanceChartsSectionProps) {
    return (
        <div className="card">
            <div className="card-header card-header-with-action">
                <div className="card-header-left">
                    <h3 className="card-title">Financial Overview</h3>
                    <p className="card-subtitle">Balance trends, income vs expense, and category breakdown</p>
                </div>
            </div>
            <div className="card-body">
                <div className="finance-charts-row">
                    <div className="finance-chart-panel">
                        <p className="finance-chart-panel-label">Balance Over Time</p>
                        <div className="finance-chart-body">
                            <ResponsiveContainer width="100%" height={240}>
                                <LineChart data={balanceOverTime}>
                                    <CartesianGrid strokeDasharray="4 4" stroke="#e8e8e8" />
                                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                    <YAxis tickFormatter={formatAxis} tick={{ fontSize: 11 }} />
                                    <Tooltip />
                                    <Line
                                        type="monotone"
                                        dataKey="balance"
                                        stroke={PURPLE}
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="finance-chart-panel">
                        <p className="finance-chart-panel-label">Income vs Expense</p>
                        <div className="finance-chart-body">
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={incomeVsExpenseByMonth}>
                                    <CartesianGrid strokeDasharray="4 4" stroke="#e8e8e8" />
                                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                    <YAxis tickFormatter={formatAxis} tick={{ fontSize: 11 }} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="income" fill={GREEN} radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="expense" fill="#dc2626" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="finance-chart-panel">
                        <p className="finance-chart-panel-label">Expense by Category</p>
                        <div className="finance-chart-body">
                            {expenseByCategory.length === 0 ? (
                                <p className="empty-message">No expense data yet.</p>
                            ) : (
                                <ResponsiveContainer width="100%" height={240}>
                                    <PieChart>
                                        <Pie
                                            data={expenseByCategory}
                                            dataKey="amount"
                                            nameKey="category"
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={80}
                                            label={({ name, percent }) =>
                                                `${String(name ?? '')} (${((percent ?? 0) * 100).toFixed(0)}%)`
                                            }
                                        >
                                            {expenseByCategory.map((entry, index) => (
                                                <Cell
                                                    key={entry.category}
                                                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                                                />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
