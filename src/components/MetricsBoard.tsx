'use client';

import { useQuakeStore } from '../store/quakeStore';

export default function MetricsBoard() {
  const metrics = useQuakeStore((s) => s.metrics);

  return (
    <div className="bg-gray-950/85 backdrop-blur-2xl border border-gray-700/40 rounded-2xl p-4 space-y-3 shadow-2xl">
      {/* Title */}
      <div className="flex items-center gap-2">
        <span className="text-sm">📊</span>
        <h2 className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Hasar Analiz Raporu</h2>
      </div>

      {/* Damage Distribution */}
      <div className="space-y-1.5">
        {[
          { label: 'Yıkık', count: metrics.yikikCount, color: 'bg-red-500', text: 'text-red-400' },
          { label: 'Ağır Hasarlı', count: metrics.agirCount, color: 'bg-orange-500', text: 'text-orange-400' },
          { label: 'Orta Hasarlı', count: metrics.ortaCount, color: 'bg-yellow-500', text: 'text-yellow-400' },
          { label: 'Hafif Hasarlı', count: metrics.hafifCount, color: 'bg-green-500', text: 'text-green-400' },
          { label: 'Sağlam', count: metrics.saglamCount, color: 'bg-slate-500', text: 'text-slate-400' },
        ].map((d) => {
          const pct = metrics.scannedCount > 0 ? (d.count / metrics.scannedCount) * 100 : 0;
          return (
            <div key={d.label} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${d.color} flex-shrink-0`} />
              <span className="text-[10px] text-gray-400 w-20 flex-shrink-0">{d.label}</span>
              <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className={`h-full ${d.color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
              </div>
              <span className={`text-[11px] font-bold tabular-nums w-10 text-right ${d.text}`}>{d.count.toLocaleString()}</span>
            </div>
          );
        })}
      </div>

      <div className="h-px bg-gray-800/50" />

      {/* KPI */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-900/50 rounded-xl p-2.5">
          <div className="text-[8px] text-gray-600 uppercase tracking-wider">Toplam Bina</div>
          <div className="text-base font-black text-white tabular-nums">{metrics.totalBuildings.toLocaleString()}</div>
        </div>
        <div className="bg-gray-900/50 rounded-xl p-2.5">
          <div className="text-[8px] text-gray-600 uppercase tracking-wider">Etkilenen Kişi</div>
          <div className="text-base font-black text-cyan-400 tabular-nums">{metrics.estimatedLivesSaved.toLocaleString()}</div>
        </div>
        <div className="bg-gray-900/50 rounded-xl p-2.5">
          <div className="text-[8px] text-gray-600 uppercase tracking-wider">Aktif Görev</div>
          <div className="text-base font-black text-amber-400 tabular-nums">{metrics.activeMissions}</div>
        </div>
        <div className="bg-gray-900/50 rounded-xl p-2.5">
          <div className="text-[8px] text-gray-600 uppercase tracking-wider">Acil Müdahale</div>
          <div className="text-base font-black text-red-400 tabular-nums">{metrics.yikikCount + metrics.agirCount}</div>
          <div className="text-[8px] text-gray-600">bina</div>
        </div>
      </div>
    </div>
  );
}
