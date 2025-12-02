'use server';

import { GoogleGenAI } from "@google/genai";

export async function analyzeSpending(summary: {
    income: number;
    expense: number;
    balance: number;
    topCategories: { category: string; amount: number }[];
    month: string;
}) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set');
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
    당신은 재정 관리 전문가입니다. 다음은 사용자의 ${summary.month} 소비 내역 요약입니다.
    
    - 총 수입: ${summary.income.toLocaleString()}원
    - 총 지출: ${summary.expense.toLocaleString()}원
    - 잔액: ${summary.balance.toLocaleString()}원
    - 지출 상위 카테고리:
      ${summary.topCategories.map(c => `- ${c.category}: ${c.amount.toLocaleString()}원`).join('\n      ')}
    
    이 데이터를 바탕으로 사용자에게 도움이 될 만한 소비 분석과 절약 팁을 3~4문장으로 간결하게 조언해주세요.
    친근하고 격려하는 어조로 작성해주세요.
  `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        return response.text;
    } catch (error) {
        console.error('Gemini API Error:', error);
        throw new Error('AI 분석 중 오류가 발생했습니다.');
    }
}
