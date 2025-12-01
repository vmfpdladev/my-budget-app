-- 가계부 앱을 위한 transactions 테이블 생성
-- Supabase SQL Editor에서 이 스크립트를 실행하세요

CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  amount NUMERIC(10, 2) NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('식비', '교통', '쇼핑', '월급', '기타')),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security 활성화
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 모든 작업을 허용하는 정책 생성 (개발용)
-- 프로덕션 환경에서는 더 엄격한 정책을 사용하세요
CREATE POLICY "Allow all operations" ON transactions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 인덱스 추가 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

-- 카테고리 제약조건 제거 (동적 카테고리 추가를 위해)
-- 기존 테이블이 있다면 이 스크립트를 실행하세요
DO $$
BEGIN
  -- category 컬럼의 CHECK 제약조건 찾기 및 제거
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name LIKE '%category%' 
    AND table_name = 'transactions'
  ) THEN
    ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_category_check;
  END IF;
END $$;

