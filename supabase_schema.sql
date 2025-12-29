
-- Create a table to store the summary of each settlement
CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  huan_total NUMERIC(10, 2) NOT NULL,
  yan_total NUMERIC(10, 2) NOT NULL,
  grand_total NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create a table to store individual items for each settlement
CREATE TABLE IF NOT EXISTS settlement_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID REFERENCES settlements(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  payer TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_items ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access (Adjust as needed)
CREATE POLICY "Allow anon insert settlements" ON settlements FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon select settlements" ON settlements FOR SELECT USING (true);
CREATE POLICY "Allow anon delete settlements" ON settlements FOR DELETE USING (true);

CREATE POLICY "Allow anon insert items" ON settlement_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon select items" ON settlement_items FOR SELECT USING (true);
CREATE POLICY "Allow anon delete items" ON settlement_items FOR DELETE USING (true);
