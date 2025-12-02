'use client';

import { useState } from 'react';
import { analyzeSpending } from '../actions/analyze-spending';

interface Transaction {
    id: number;
    amount: number;
    description: string;
    category: string;
    type: 'income' | 'expense';
    created_at: string;
}

interface AIAnalysisProps {
    transactions: Transaction[];
    year: number;
    month: number;
}

export default function AIAnalysis({ transactions, year, month }: AIAnalysisProps) {
    const [analysis, setAnalysis] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    const handleAnalyze = async () => {
        setLoading(true);
        setError('');
        setAnalysis('');

        try {
            // Calculate summary
            const income = transactions
                .filter(t => t.type === 'income')
                .reduce((sum, t) => sum + Number(t.amount), 0);

            const expense = transactions
                .filter(t => t.type === 'expense')
                .reduce((sum, t) => sum + Number(t.amount), 0);

            const balance = income - expense;

            // Calculate top categories
            const categoryMap = new Map<string, number>();
            transactions
                .filter(t => t.type === 'expense')
                .forEach(t => {
                    const current = categoryMap.get(t.category) || 0;
                    categoryMap.set(t.category, current + Number(t.amount));
                });

            const topCategories = Array.from(categoryMap.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([category, amount]) => ({ category, amount }));

            const result = await analyzeSpending({
                income,
                expense,
                balance,
                topCategories,
                month: `${year}년 ${month}월`,
            });

            if (result) {
                setAnalysis(result);
            }
        } catch (err) {
            console.error(err);
            setError('분석에 실패했습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8 border border-purple-100">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                    ✨ AI 소비 분석
                </h2>
                {!analysis && !loading && (
                    <button
                        onClick={handleAnalyze}
                        className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors text-sm font-medium"
                    >
                        분석하기
                    </button>
                )}
            </div>

            {loading && (
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    <span className="ml-3 text-gray-600">AI가 소비 내역을 분석하고 있습니다...</span>
                </div>
            )}

            {error && (
                <div className="text-red-500 text-sm bg-red-50 p-3 rounded-md">
                    {error}
                </div>
            )}

            {analysis && (
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {analysis}
                    </p>
                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={handleAnalyze}
                            className="text-xs text-purple-600 hover:text-purple-800 underline"
                        >
                            다시 분석하기
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
