'use client'

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

interface ProfileChartProps {
  history: any[]
}

export default function ProfileChart({ history }: ProfileChartProps) {
  // Process history for chart
  // History comes in DESC order (newest first).
  // We need to reverse it to be chronological (oldest -> newest).
  // We also want to calculate the cumulative balance at each point.
  // Ideally, we know the "chips_after" value.
  
  const chartData = [...history].reverse().map((game, index) => ({
    index: index + 1,
    chips: game.chips_after,
    profit: game.profit,
    date: new Date(game.played_at).toLocaleDateString()
  }))

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="colorChips" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
        <XAxis 
          dataKey="index" 
          stroke="#94a3b8" 
          tick={{ fontSize: 12 }} 
          tickLine={false}
          axisLine={false}
        />
        <YAxis 
          stroke="#94a3b8" 
          tick={{ fontSize: 12 }} 
          tickLine={false}
          axisLine={false}
          domain={['auto', 'auto']}
        />
        <Tooltip 
          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f1f5f9' }}
          itemStyle={{ color: '#f59e0b' }}
          labelStyle={{ color: '#94a3b8' }}
        />
        <Area 
          type="monotone" 
          dataKey="chips" 
          stroke="#f59e0b" 
          strokeWidth={2}
          fillOpacity={1} 
          fill="url(#colorChips)" 
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
