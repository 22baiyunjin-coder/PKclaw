-- 创建所有需要的表和初始数据

-- 1. profiles 表 (如果不存在)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  score INTEGER DEFAULT 0,
  total_hands INTEGER DEFAULT 0,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. game_history 表
CREATE TABLE IF NOT EXISTS game_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  score_change INTEGER NOT NULL,
  hand_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. AI personas 预设
CREATE TABLE IF NOT EXISTS ai_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  vpip FLOAT,
  pfr FLOAT,
  profile JSONB,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 用户角色库
CREATE TABLE IF NOT EXISTS user_persona_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  persona_id UUID REFERENCES ai_personas(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 角色投票
CREATE TABLE IF NOT EXISTS persona_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  persona_id UUID REFERENCES ai_personas(id) ON DELETE CASCADE,
  vote INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 排行榜
CREATE TABLE IF NOT EXISTS leaderboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  username TEXT,
  score INTEGER DEFAULT 0,
  rank INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. 添加 hand_records 表 (如果 migration 还没跑)
CREATE TABLE IF NOT EXISTS hand_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'played' CHECK (source IN ('played', 'imported', 'reconstructed', 'simulated')),
  status TEXT NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'draft', 'reconstructed', 'simulated')),
  title TEXT NOT NULL,
  table_name TEXT NOT NULL DEFAULT 'PokerMind Arena',
  hero_name TEXT NOT NULL,
  hero_seat INTEGER NOT NULL DEFAULT 0,
  seat_count INTEGER NOT NULL DEFAULT 8,
  small_blind INTEGER NOT NULL DEFAULT 10,
  big_blind INTEGER NOT NULL DEFAULT 20,
  final_street TEXT NOT NULL DEFAULT 'showdown' CHECK (final_street IN ('preflop', 'flop', 'turn', 'river', 'showdown')),
  action_count INTEGER NOT NULL DEFAULT 0,
  hero_profit INTEGER NOT NULL DEFAULT 0,
  pot_size INTEGER NOT NULL DEFAULT 0,
  summary TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  raw_input TEXT,
  hand_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  replay_payload JSONB,
  analysis_payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS hand_records_user_id_created_at_idx ON hand_records(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS hand_records_source_idx ON hand_records(source);

-- 启用 RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_persona_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE persona_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboards ENABLE ROW LEVEL SECURITY;

-- profiles RLS
DROP POLICY IF EXISTS "Users can read their own profile" ON profiles;
CREATE POLICY "Users can read their own profile" ON profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- game_history RLS
DROP POLICY IF EXISTS "Users can read their own game history" ON game_history;
CREATE POLICY "Users can read their own game history" ON game_history FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own game history" ON game_history;
CREATE POLICY "Users can insert their own game history" ON game_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ai_personas RLS (公开可读)
DROP POLICY IF EXISTS "Anyone can read ai_personas" ON ai_personas;
CREATE POLICY "Anyone can read ai_personas" ON ai_personas FOR SELECT USING (true);

-- leaderboards RLS (公开可读)
DROP POLICY IF EXISTS "Anyone can read leaderboards" ON leaderboards;
CREATE POLICY "Anyone can read leaderboards" ON leaderboards FOR SELECT USING (true);

-- 插入默认 AI personas
INSERT INTO ai_personas (name, description, vpip, pfr, profile, is_default) VALUES
('Aggressive Shark', '激进鲨鱼 - 喜欢下注和加注，善于施压', 45, 35, 
 '{"style": "aggressive", "pressure": true}'::jsonb, true),
('GTO Master', 'GTO大师 - 平衡型打法，基于Solver最优策略', 22, 18, 
 '{"style": "gto", "solver_based": true}'::jsonb, true),
('Tight Passive', '紧弱玩家 - 玩得紧但跟注多', 15, 10, 
 '{"style": "tight_passive", "calling_station": true}'::jsonb, true),
('Loose Aggressive', '松凶玩家 - 玩得松且凶猛', 55, 40, 
 '{"style": "loose_aggressive", "bluffing": true}'::jsonb, true),
('Nit', '岩石玩家 - 极紧，只玩强牌', 10, 8, 
 '{"style": "nit", "premium_only": true}'::jsonb, true),
('Maniac', '疯子 - 极度激进，什么都敢玩', 70, 60, 
 '{"style": "maniac", "unpredictable": true}'::jsonb, true)
ON CONFLICT DO NOTHING;
