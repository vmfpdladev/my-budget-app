'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import dynamic from 'next/dynamic';

// recharts를 동적으로 import (SSR 방지)
const MonthlyComparisonChart = dynamic(
  () => {
    try {
      return import('recharts').then((mod) => {
        const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } = mod;
        return ({ currentMonth, previousMonth, formatCurrency }: { 
          currentMonth: { income: number; expense: number }; 
          previousMonth: { income: number; expense: number };
          formatCurrency: (value: number) => string;
        }) => (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={[
              { name: '수입', 이번달: currentMonth.income, 전월: previousMonth.income },
              { name: '지출', 이번달: currentMonth.expense, 전월: previousMonth.expense },
            ]}>
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
      });
    } catch (e) {
      // recharts가 없을 경우 대체 컴포넌트
      return () => (
        <div className="text-center py-8 text-gray-500">
          그래프를 표시하려면 recharts 라이브러리가 필요합니다.
          <br />
          <code className="text-sm">npm install recharts</code>를 실행해주세요.
        </div>
      );
    }
  },
  { ssr: false }
);

type TransactionType = 'income' | 'expense';
type Currency = 'KRW' | 'USD';
type CalendarView = 'month' | 'week';

interface Transaction {
  id: number;
  amount: number;
  description: string;
  category: string;
  type: TransactionType;
  created_at: string;
}

export default function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [categories, setCategories] = useState<string[]>(['식비', '교통', '쇼핑', '월급', '기타']);
  const [category, setCategory] = useState<string>('기타');
  const [newCategory, setNewCategory] = useState<string>('');
  const [type, setType] = useState<TransactionType>('expense');
  const [loading, setLoading] = useState<boolean>(true);
  const [currency, setCurrency] = useState<Currency>('KRW');
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [exchangeRateLoading, setExchangeRateLoading] = useState<boolean>(false);
  const [calendarView, setCalendarView] = useState<CalendarView>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedFilterDate, setSelectedFilterDate] = useState<Date | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState<boolean>(false);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());

  // 초기 데이터 로드
  useEffect(() => {
    loadTransactions();
    loadExchangeRate();
    
    // 환율을 주기적으로 업데이트 (1시간마다)
    const interval = setInterval(() => {
      loadExchangeRate();
    }, 3600000); // 1시간 = 3600000ms

    return () => clearInterval(interval);
  }, []);

  // localStorage에서 통화 선택 불러오기
  useEffect(() => {
    const savedCurrency = localStorage.getItem('currency') as Currency | null;
    if (savedCurrency && (savedCurrency === 'KRW' || savedCurrency === 'USD')) {
      setCurrency(savedCurrency);
    }
    
    // localStorage에서 카테고리 불러오기
    const savedCategories = localStorage.getItem('categories');
    if (savedCategories) {
      try {
        const parsed = JSON.parse(savedCategories);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCategories(parsed);
          setCategory(parsed[0]);
        }
      } catch (e) {
        console.error('Failed to parse categories:', e);
      }
    }
  }, []);

  // 통화 선택 저장
  useEffect(() => {
    localStorage.setItem('currency', currency);
  }, [currency]);

  // 카테고리 저장
  useEffect(() => {
    localStorage.setItem('categories', JSON.stringify(categories));
  }, [categories]);

  const loadExchangeRate = async () => {
    try {
      setExchangeRateLoading(true);
      // 무료 환율 API 사용 (exchangerate-api.com)
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      if (!response.ok) {
        throw new Error('환율 정보를 가져올 수 없습니다.');
      }
      const data = await response.json();
      // USD를 기준으로 KRW 환율 가져오기
      const krwRate = data.rates?.KRW;
      if (krwRate) {
        setExchangeRate(krwRate);
      }
    } catch (error) {
      console.error('Error loading exchange rate:', error);
      // 실패 시 기본 환율 사용 (약 1300원)
      setExchangeRate(1300);
    } finally {
      setExchangeRateLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading transactions:', error);
        alert('데이터를 불러오는 중 오류가 발생했습니다.');
        return;
      }

      if (data) {
        setTransactions(data);
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      alert('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number): string => {
    if (currency === 'USD') {
      // KRW를 USD로 변환 (데이터베이스의 금액은 KRW 기준)
      const usdValue = exchangeRate ? value / exchangeRate : value / 1300;
      return `$${usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      return `₩${value.toLocaleString('ko-KR')}`;
    }
  };

  // 월별 거래 필터링
  const getTransactionsForMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return transactions.filter((t) => {
      const tDate = new Date(t.created_at);
      return tDate.getFullYear() === year && tDate.getMonth() === month;
    });
  };

  // 월별 요약 계산
  const calculateMonthlySummary = (date: Date) => {
    const monthTransactions = getTransactionsForMonth(date);
    const income = monthTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const expense = monthTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const balance = income - expense;
    return { income, expense, balance };
  };

  // 전월 날짜 계산
  const getPreviousMonth = (date: Date) => {
    const prev = new Date(date);
    prev.setMonth(prev.getMonth() - 1);
    return prev;
  };

  const addTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      alert('올바른 금액을 입력해주세요.');
      return;
    }

    // 10원 단위로 반올림
    const roundedAmount = Math.round(amountNum / 10) * 10;

    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert([
          {
            amount: roundedAmount,
            description: description || '내용 없음',
            category,
            type,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Error adding transaction:', error);
        alert('거래를 추가하는 중 오류가 발생했습니다.');
        return;
      }

      if (data) {
        setTransactions([data, ...transactions]);
        setAmount('');
        setDescription('');
        if (categories.length > 0) {
          setCategory(categories[0]);
        }
        setType('expense');
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      alert('거래를 추가하는 중 오류가 발생했습니다.');
    }
  };

  const addCategory = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      setCategories([...categories, newCategory.trim()]);
      setNewCategory('');
    }
  };

  const deleteCategory = (catToDelete: string) => {
    if (categories.length <= 1) {
      alert('최소 하나의 카테고리는 필요합니다.');
      return;
    }
    if (confirm(`"${catToDelete}" 카테고리를 삭제하시겠습니까?`)) {
      const updated = categories.filter(cat => cat !== catToDelete);
      setCategories(updated);
      if (category === catToDelete && updated.length > 0) {
        setCategory(updated[0]);
      }
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // 자유롭게 입력 가능 (반올림하지 않음)
    setAmount(value);
  };

  const handleAmountBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      return;
    }
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) {
      // 포커스 아웃 시 10원 단위로 반올림
      const rounded = Math.round(num / 10) * 10;
      setAmount(rounded.toString());
    }
  };

  const handleAmountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const current = parseFloat(amount) || 0;
      const step = e.key === 'ArrowUp' ? 10 : -10;
      const newValue = Math.max(0, current + step);
      const rounded = Math.round(newValue / 10) * 10;
      setAmount(rounded.toString());
    }
  };

  // 캘린더 관련 함수들
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    // 이전 달의 마지막 날들
    const prevMonth = new Date(year, month, 0);
    const prevMonthDays = prevMonth.getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push(new Date(year, month - 1, prevMonthDays - i));
    }
    // 현재 달의 날들
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    // 다음 달의 첫 날들 (캘린더를 채우기 위해)
    const remainingDays = 42 - days.length; // 6주 * 7일
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i));
    }
    return days;
  };

  const getWeekDays = (date: Date) => {
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay()); // 일요일로 시작
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getTransactionsForDate = (date: Date) => {
    return transactions.filter(t => {
      const tDate = new Date(t.created_at);
      return (
        tDate.getFullYear() === date.getFullYear() &&
        tDate.getMonth() === date.getMonth() &&
        tDate.getDate() === date.getDate()
      );
    });
  };

  const getTotalForDate = (date: Date) => {
    const dayTransactions = getTransactionsForDate(date);
    return dayTransactions.reduce((sum, t) => {
      return sum + (t.type === 'income' ? Number(t.amount) : -Number(t.amount));
    }, 0);
  };

  const isDateSelected = (date: Date) => {
    if (!selectedFilterDate) return false;
    return (
      date.getFullYear() === selectedFilterDate.getFullYear() &&
      date.getMonth() === selectedFilterDate.getMonth() &&
      date.getDate() === selectedFilterDate.getDate()
    );
  };

  const handleDateClick = (date: Date) => {
    // 같은 날짜를 다시 클릭하면 필터 해제
    if (isDateSelected(date)) {
      setSelectedFilterDate(null);
    } else {
      setSelectedFilterDate(new Date(date));
    }
  };

  const getFilteredTransactions = () => {
    if (!selectedFilterDate) {
      return transactions;
    }
    return transactions.filter(t => {
      const tDate = new Date(t.created_at);
      return (
        tDate.getFullYear() === selectedFilterDate.getFullYear() &&
        tDate.getMonth() === selectedFilterDate.getMonth() &&
        tDate.getDate() === selectedFilterDate.getDate()
      );
    });
  };

  const deleteTransaction = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting transaction:', error);
        alert('거래를 삭제하는 중 오류가 발생했습니다.');
        return;
      }

      setTransactions(transactions.filter((t) => t.id !== id));
    } catch (error) {
      console.error('Unexpected error:', error);
      alert('거래를 삭제하는 중 오류가 발생했습니다.');
    }
  };

  const { income, expense, balance } = calculateMonthlySummary(selectedMonth);
  const previousMonthSummary = calculateMonthlySummary(getPreviousMonth(selectedMonth));

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">
            나의 가계부
          </h1>
          <div className="flex items-center gap-3">
            {exchangeRateLoading && (
              <span className="text-xs text-gray-500">환율 로딩 중...</span>
            )}
            {exchangeRate && (
              <span className="text-xs text-gray-500">
                1 USD = {exchangeRate.toLocaleString('ko-KR')} KRW
              </span>
            )}
            <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
              <button
                onClick={() => setCurrency('KRW')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  currency === 'KRW'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                원화 (₩)
              </button>
              <button
                onClick={() => setCurrency('USD')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  currency === 'USD'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                달러 ($)
              </button>
            </div>
          </div>
        </div>

        {/* 월 선택 섹션 */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">조회 월:</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const newDate = new Date(selectedMonth);
                  newDate.setMonth(newDate.getMonth() - 1);
                  setSelectedMonth(newDate);
                }}
                className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded"
              >
                ←
              </button>
              <input
                type="month"
                value={`${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`}
                onChange={(e) => {
                  const [year, month] = e.target.value.split('-').map(Number);
                  setSelectedMonth(new Date(year, month - 1));
                }}
                className="px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => {
                  const newDate = new Date(selectedMonth);
                  newDate.setMonth(newDate.getMonth() + 1);
                  setSelectedMonth(newDate);
                }}
                className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded"
              >
                →
              </button>
              <button
                onClick={() => setSelectedMonth(new Date())}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                이번 달
              </button>
            </div>
          </div>
        </div>

        {/* 요약 카드 섹션 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
            <h2 className="text-sm font-medium text-gray-600 mb-2">
              총 수입 ({selectedMonth.getFullYear()}년 {selectedMonth.getMonth() + 1}월)
            </h2>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(income)}
            </p>
            {previousMonthSummary.income > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                전월 대비: {income >= previousMonthSummary.income ? '+' : ''}
                {formatCurrency(income - previousMonthSummary.income)} (
                {previousMonthSummary.income > 0
                  ? ((income / previousMonthSummary.income - 1) * 100).toFixed(1)
                  : '0'}
                %)
              </p>
            )}
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
            <h2 className="text-sm font-medium text-gray-600 mb-2">
              총 지출 ({selectedMonth.getFullYear()}년 {selectedMonth.getMonth() + 1}월)
            </h2>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(expense)}
            </p>
            {previousMonthSummary.expense > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                전월 대비: {expense >= previousMonthSummary.expense ? '+' : ''}
                {formatCurrency(expense - previousMonthSummary.expense)} (
                {previousMonthSummary.expense > 0
                  ? ((expense / previousMonthSummary.expense - 1) * 100).toFixed(1)
                  : '0'}
                %)
              </p>
            )}
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-gray-500">
            <h2 className="text-sm font-medium text-gray-600 mb-2">
              잔액 ({selectedMonth.getFullYear()}년 {selectedMonth.getMonth() + 1}월)
            </h2>
            <p
              className={`text-2xl font-bold ${
                balance >= 0 ? 'text-blue-600' : 'text-red-600'
              }`}
            >
              {formatCurrency(balance)}
            </p>
            {previousMonthSummary.balance !== 0 && (
              <p className="text-xs text-gray-500 mt-1">
                전월 대비: {balance >= previousMonthSummary.balance ? '+' : ''}
                {formatCurrency(balance - previousMonthSummary.balance)}
              </p>
            )}
          </div>
        </div>

        {/* 전월 비교 통계 그래프 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            전월 대비 통계 ({selectedMonth.getFullYear()}년 {selectedMonth.getMonth() + 1}월 vs {getPreviousMonth(selectedMonth).getFullYear()}년 {getPreviousMonth(selectedMonth).getMonth() + 1}월)
          </h2>
          <div className="w-full">
            {typeof window !== 'undefined' && (
              <MonthlyComparisonChart
                currentMonth={{ income, expense }}
                previousMonth={previousMonthSummary}
                formatCurrency={formatCurrency}
              />
            )}
          </div>
        </div>

        {/* 기록 입력 폼 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            수입/지출 기록하기
          </h2>
          <form onSubmit={addTransaction} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                금액 <span className="text-red-500">*</span> <span className="text-xs text-gray-500">(10원 단위)</span>
              </label>
              <input
                type="number"
                value={amount}
                onChange={handleAmountChange}
                onBlur={handleAmountBlur}
                onKeyDown={handleAmountKeyDown}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="금액을 입력하세요"
                required
                min="0"
                step="1"
              />
              <p className="text-xs text-gray-500 mt-1">
                자유롭게 입력 가능 (포커스 아웃 시 10원 단위로 자동 반올림) • ↑↓ 화살표 키로 10원씩 조정 가능
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                내용
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="예: 점심값, 월급"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  카테고리
                </label>
                <button
                  type="button"
                  onClick={() => setShowCategoryManager(!showCategoryManager)}
                  className="text-xs text-blue-600 hover:text-blue-700 underline"
                >
                  {showCategoryManager ? '닫기' : '관리'}
                </button>
              </div>
              {showCategoryManager && (
                <div className="mb-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addCategory()}
                      className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="새 카테고리 이름"
                    />
                    <button
                      type="button"
                      onClick={addCategory}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      추가
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                      <div
                        key={cat}
                        className="flex items-center gap-1 px-2 py-1 bg-white rounded-md border border-gray-300"
                      >
                        <span className="text-sm">{cat}</span>
                        {categories.length > 1 && (
                          <button
                            type="button"
                            onClick={() => deleteCategory(cat)}
                            className="text-red-500 hover:text-red-700 text-xs"
                            title="삭제"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                구분
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="income"
                    checked={type === 'income'}
                    onChange={(e) => setType(e.target.value as TransactionType)}
                    className="mr-2"
                  />
                  <span className="text-blue-600 font-medium">수입</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="expense"
                    checked={type === 'expense'}
                    onChange={(e) => setType(e.target.value as TransactionType)}
                    className="mr-2"
                  />
                  <span className="text-red-600 font-medium">지출</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              추가하기
            </button>
          </form>
        </div>

        {/* 기록 목록 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">
              기록 목록
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setCalendarView('month')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  calendarView === 'month'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                월별
              </button>
              <button
                onClick={() => setCalendarView('week')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  calendarView === 'week'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                주별
              </button>
            </div>
          </div>

          {/* 캘린더 뷰 */}
          <div className="mb-6">
            {calendarView === 'month' ? (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 p-4 flex justify-between items-center">
                  <button
                    onClick={() => {
                      const newDate = new Date(selectedDate);
                      newDate.setMonth(newDate.getMonth() - 1);
                      setSelectedDate(newDate);
                    }}
                    className="px-3 py-1 text-gray-600 hover:bg-gray-200 rounded"
                  >
                    ←
                  </button>
                  <h3 className="text-lg font-semibold">
                    {selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월
                  </h3>
                  <button
                    onClick={() => {
                      const newDate = new Date(selectedDate);
                      newDate.setMonth(newDate.getMonth() + 1);
                      setSelectedDate(newDate);
                    }}
                    className="px-3 py-1 text-gray-600 hover:bg-gray-200 rounded"
                  >
                    →
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-px bg-gray-200">
                  {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
                    <div
                      key={day}
                      className="bg-gray-50 p-2 text-center text-sm font-medium text-gray-700"
                    >
                      {day}
                    </div>
                  ))}
                  {getDaysInMonth(selectedDate).map((day, idx) => {
                    const isCurrentMonth = day.getMonth() === selectedDate.getMonth();
                    const isToday =
                      day.toDateString() === new Date().toDateString();
                    const dayTransactions = getTransactionsForDate(day);
                    const dayTotal = getTotalForDate(day);
                    const isSelected = isDateSelected(day);

                    return (
                      <div
                        key={idx}
                        onClick={() => handleDateClick(day)}
                        className={`bg-white p-2 min-h-[80px] border-b border-r border-gray-200 cursor-pointer transition-colors hover:bg-gray-50 ${
                          !isCurrentMonth ? 'opacity-40' : ''
                        } ${isToday ? 'bg-blue-50 border-blue-300' : ''} ${
                          isSelected ? 'bg-blue-200 border-blue-500 border-2' : ''
                        }`}
                      >
                        <div className="text-sm font-medium mb-1">
                          {day.getDate()}
                        </div>
                        {dayTransactions.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-xs">
                              <span className="text-blue-600">
                                +{dayTransactions.filter(t => t.type === 'income').length}
                              </span>
                              {' '}
                              <span className="text-red-600">
                                -{dayTransactions.filter(t => t.type === 'expense').length}
                              </span>
                            </div>
                            {dayTotal !== 0 && (
                              <div
                                className={`text-xs font-semibold ${
                                  dayTotal >= 0 ? 'text-blue-600' : 'text-red-600'
                                }`}
                              >
                                {formatCurrency(Math.abs(dayTotal))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 p-4 flex justify-between items-center">
                  <button
                    onClick={() => {
                      const newDate = new Date(selectedDate);
                      newDate.setDate(newDate.getDate() - 7);
                      setSelectedDate(newDate);
                    }}
                    className="px-3 py-1 text-gray-600 hover:bg-gray-200 rounded"
                  >
                    ← 이전 주
                  </button>
                  <h3 className="text-lg font-semibold">
                    {selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월{' '}
                    {Math.floor((selectedDate.getDate() - selectedDate.getDay()) / 7) + 1}주차
                  </h3>
                  <button
                    onClick={() => {
                      const newDate = new Date(selectedDate);
                      newDate.setDate(newDate.getDate() + 7);
                      setSelectedDate(newDate);
                    }}
                    className="px-3 py-1 text-gray-600 hover:bg-gray-200 rounded"
                  >
                    다음 주 →
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-px bg-gray-200">
                  {getWeekDays(selectedDate).map((day, idx) => {
                    const isToday = day.toDateString() === new Date().toDateString();
                    const dayTransactions = getTransactionsForDate(day);
                    const dayTotal = getTotalForDate(day);
                    const isSelected = isDateSelected(day);

                    return (
                      <div
                        key={idx}
                        onClick={() => handleDateClick(day)}
                        className={`bg-white p-3 min-h-[120px] cursor-pointer transition-colors hover:bg-gray-50 ${
                          isToday ? 'bg-blue-50 border-2 border-blue-300' : ''
                        } ${
                          isSelected ? 'bg-blue-200 border-2 border-blue-500' : ''
                        }`}
                      >
                        <div className="text-sm font-medium mb-2">
                          {day.getMonth() + 1}/{day.getDate()}
                          <span className="text-xs text-gray-500 ml-1">
                            {['일', '월', '화', '수', '목', '금', '토'][day.getDay()]}
                          </span>
                        </div>
                        {dayTransactions.length > 0 ? (
                          <div className="space-y-1">
                            {dayTransactions.slice(0, 3).map((t) => (
                              <div
                                key={t.id}
                                className={`text-xs p-1 rounded ${
                                  t.type === 'income'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                <div className="font-semibold">
                                  {formatCurrency(Number(t.amount))}
                                </div>
                                <div className="truncate">{t.description}</div>
                              </div>
                            ))}
                            {dayTransactions.length > 3 && (
                              <div className="text-xs text-gray-500">
                                +{dayTransactions.length - 3}개 더
                              </div>
                            )}
                            {dayTotal !== 0 && (
                              <div
                                className={`text-xs font-bold mt-1 pt-1 border-t ${
                                  dayTotal >= 0 ? 'text-blue-600' : 'text-red-600'
                                }`}
                              >
                                합계: {formatCurrency(Math.abs(dayTotal))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400">내역 없음</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 거래 목록 */}
          <div className="flex justify-between items-center mb-4">
            {selectedFilterDate && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  {selectedFilterDate.getFullYear()}년 {selectedFilterDate.getMonth() + 1}월 {selectedFilterDate.getDate()}일 내역
                </span>
                <button
                  onClick={() => setSelectedFilterDate(null)}
                  className="text-xs text-blue-600 hover:text-blue-700 underline"
                >
                  전체 보기
                </button>
              </div>
            )}
            {!selectedFilterDate && (
              <span className="text-sm text-gray-600">전체 내역</span>
            )}
          </div>
          {loading ? (
            <p className="text-center text-gray-500 py-8">로딩 중...</p>
          ) : getFilteredTransactions().length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              {selectedFilterDate 
                ? '선택한 날짜에 기록된 내역이 없습니다.'
                : '기록된 내역이 없습니다.'}
            </p>
          ) : (
            <div className="space-y-3">
              {getFilteredTransactions().map((transaction) => (
                <div
                  key={transaction.id}
                  className={`p-4 rounded-lg border-l-4 ${
                    transaction.type === 'income'
                      ? 'bg-blue-50 border-blue-500'
                      : 'bg-red-50 border-red-500'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-lg font-bold ${
                            transaction.type === 'income'
                              ? 'text-blue-600'
                              : 'text-red-600'
                          }`}
                        >
                          {formatCurrency(Number(transaction.amount))}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            transaction.type === 'income'
                              ? 'bg-blue-200 text-blue-800'
                              : 'bg-red-200 text-red-800'
                          }`}
                        >
                          {transaction.type === 'income' ? '수입' : '지출'}
                        </span>
                      </div>
                      <p className="text-gray-700 font-medium">
                        {transaction.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                        <span>{transaction.category}</span>
                        <span>•</span>
                        <span>
                          {new Date(transaction.created_at).toLocaleDateString(
                            'ko-KR',
                            {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            }
                          )}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteTransaction(transaction.id)}
                      className="ml-4 px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
