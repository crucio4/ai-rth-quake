'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuakeStore } from '../store/quakeStore';
import MetricsBoard from '../components/MetricsBoard';
import EmergencyPanel from '../components/EmergencyPanel';

const MapView = dynamic(() => import('../components/MapView'), { ssr: false });

export default function Home() {
  const { initialize, metrics, dataReady, loadingProgress, showBeforeAfter, toggleBeforeAfter, priorityZones } = useQuakeStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    initialize();
  }, [initialize]);

  if (!mounted) return null;

  const criticalZones = priorityZones.filter((z) => z.level === 'critical').length;
  const highZones = priorityZones.filter((z) => z.level === 'high').length;

  return (
    <div className="h-screen w-screen bg-gray-950 text-white overflow-hidden relative">
      {/* FULL SCREEN MAP — appears immediately */}
      <div className="absolute inset-0 z-0">
        <MapView />
      </div>

      {/* Loading overlay — subtle progress bar over the map */}
      {!dataReady && loadingProgress > 0 && (
        <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
          <div className="h-1 bg-gray-800/50">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 transition-all duration-300 ease-out"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
          <div className="flex items-center justify-center mt-4">
            <div className="bg-gray-950/80 backdrop-blur-xl rounded-xl px-4 py-2 border border-gray-700/40 text-[11px] text-gray-400 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              Bina verileri analiz ediliyor... {loadingProgress}%
            </div>
          </div>
        </div>
      )}

      {/* TOP BAR */}
      <header className="absolute top-0 left-0 right-0 z-40 pointer-events-none">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="pointer-events-auto flex items-center gap-3 bg-gray-950/80 backdrop-blur-xl rounded-2xl px-4 py-2.5 border border-gray-700/40 shadow-2xl">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center font-black text-sm shadow-lg shadow-red-500/20">
              D
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight leading-none">DEPREM-AI</h1>
              <p className="text-[9px] text-gray-400 tracking-widest uppercase mt-0.5">
                Yapısal Hasar Tespit & Kurtarma Platformu
              </p>
            </div>
            <div className="flex items-center gap-1.5 ml-3 pl-3 border-l border-gray-700/50">
              <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 text-[8px] font-bold border border-cyan-500/20">YOLOv8</span>
              <span className="text-gray-600 text-[8px]">→</span>
              <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 text-[8px] font-bold border border-purple-500/20">SegFormer</span>
              <span className="text-gray-600 text-[8px]">→</span>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-[8px] font-bold border border-amber-500/20">GNN</span>
              <span className="text-gray-600 text-[8px]">→</span>
              <span className="px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 text-[8px] font-bold border border-red-500/20">MARL</span>
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            {/* Before/After Toggle */}
            <button
              onClick={toggleBeforeAfter}
              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all ${
                showBeforeAfter
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  : 'bg-gray-950/70 text-gray-400 border-gray-700/40 hover:bg-gray-800/80'
              } backdrop-blur-xl`}
            >
              {showBeforeAfter ? '🏗 Deprem Sonrası Göster' : '🛰 Deprem Öncesi (Temiz)'}
            </button>

            {/* Data status */}
            <div className="bg-gray-950/70 backdrop-blur-xl rounded-xl px-3 py-2 border border-gray-700/40 text-[10px] text-gray-500 flex items-center gap-2">
              {dataReady ? (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <span>{metrics.totalBuildings.toLocaleString()} bina analiz edildi</span>
                </>
              ) : (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span>Veri yükleniyor...</span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* LEFT — Metrics Panel (floating) */}
      {dataReady && (
        <div className="absolute top-20 left-4 z-40 w-[280px] pointer-events-auto">
          <MetricsBoard />
        </div>
      )}

      {/* RIGHT — Emergency Dispatch Panel */}
      <div className="absolute top-20 right-4 z-40 w-[300px] pointer-events-auto">
        <EmergencyPanel />
      </div>

      {/* BOTTOM — Legend + Priority Summary */}
      <div className="absolute bottom-0 left-0 right-0 z-40 pointer-events-none">
        <div className="flex items-end justify-between px-4 pb-4 gap-4">
          {/* Priority zones */}
          {dataReady && (
            <div className="pointer-events-auto bg-gray-950/80 backdrop-blur-xl rounded-xl px-4 py-2.5 border border-gray-700/40">
              <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1 font-semibold">Öncelikli Bölgeler</div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /><span className="text-red-400 font-bold">{criticalZones}</span><span className="text-gray-500">Kritik</span></span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /><span className="text-orange-400 font-bold">{highZones}</span><span className="text-gray-500">Yüksek</span></span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /><span className="text-yellow-400 font-bold">{priorityZones.length - criticalZones - highZones}</span><span className="text-gray-500">Orta</span></span>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="pointer-events-auto bg-gray-950/80 backdrop-blur-xl rounded-xl px-4 py-2.5 border border-gray-700/40">
            <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1.5 font-semibold">Hasar Kategorisi · CV Pipeline</div>
            <div className="flex items-center gap-3 text-[10px]">
              {[
                { label: 'Yıkık', color: '#ef4444' },
                { label: 'Ağır', color: '#f97316' },
                { label: 'Orta', color: '#eab308' },
                { label: 'Hafif', color: '#22c55e' },
                { label: 'Sağlam', color: '#94a3b8' },
              ].map((d) => (
                <div key={d.label} className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-gray-300">{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tech stack */}
          <div className="pointer-events-auto bg-gray-950/80 backdrop-blur-xl rounded-xl px-3 py-2.5 border border-gray-700/40 text-[9px] text-gray-600">
            OSM · OSRM · CartoDB Dark · SDG 11.5
          </div>
        </div>
      </div>
    </div>
  );
}
