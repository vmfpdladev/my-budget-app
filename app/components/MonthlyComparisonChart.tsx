'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface MonthlyComparisonChartProps {
  currentMonth: { income: number; expense: number };
  previousMonth: { income: number; expense: number };
  formatCurrency: (value: number) => string;
}

export default function MonthlyComparisonChart({
  currentMonth,
  previousMonth,
  formatCurrency,
}: MonthlyComparisonChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={[
          { name: '수입', 이번달: currentMonth.income, 전월: previousMonth.income },
          { name: '지출', 이번달: currentMonth.expense, 전월: previousMonth.expense },
        ]}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip formatter={(value: number) => formatCurrency(value)} />
        <Legend />
        <Bar dataKey="이번달" fill="#3b82f6" />
        <Bar dataKey="전월" fill="#94a3b8" />
      </BarChart>
    </ResponsiveContainer>
  );
}

