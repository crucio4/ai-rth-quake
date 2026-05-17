'use client';

// ============================================================================
// DEPREM-AI — Emergency Dispatch Panel v2
// Select center → select building on map → dispatch with safe route
// Shows OSRM-computed real distance & duration
// ============================================================================

import { useQuakeStore } from '../store/quakeStore';

const TYPE_LABELS: Record<string, string> = {
  afad: 'AFAD',
  itfaiye: 'İtfaiye',
  saglik: 'Sağlık',
  jandarma: 'Emniyet',
};

export default function EmergencyPanel() {
  const {
    emergencyCenters, missions, selectedCenter, selectedBuilding,
    routingMode, selectCenter, dispatchMission, clearMissions,
    toggleRoutingMode, buildings, dataReady, dispatchLoading,
  } = useQuakeStore();

  const selectedBuildingData = selectedBuilding
    ? buildings.find((b) => b.id === selectedBuilding)
    : null;

  const handleDispatch = async () => {
    if (selectedCenter && selectedBuilding) {
      await dispatchMission(selectedCenter, selectedBuilding, true);
    }
  };

  const activeMissions = missions.filter((m) => m.status === 'active');

  return (
    <div className="bg-gray-950/85 backdrop-blur-2xl border border-gray-700/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-100px)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800/50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🚨</span>
            <h2 className="text-xs font-bold tracking-wider text-gray-300 uppercase">Acil Durum Sevk</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleRoutingMode}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                routingMode
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-gray-800 text-gray-400 border border-gray-700/50 hover:bg-gray-700'
              }`}
            >
              {routingMode ? '🔴 Rota Modu Aktif' : 'Rota Oluştur'}
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-y-auto flex-1 p-3 space-y-3">
        {/* Routing Mode UI */}
        {routingMode && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 space-y-2">
            <p className="text-[10px] text-blue-300 font-semibold uppercase tracking-wider">Safe-Route Oluşturma</p>

            {/* Step 1: Select Center */}
            <div>
              <p className="text-[10px] text-gray-500 mb-1.5">1. Merkez Seçin</p>
              <div className="grid grid-cols-1 gap-1">
                {emergencyCenters.map((center) => (
                  <button
                    key={center.id}
                    onClick={() => selectCenter(center.id)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all text-[11px] ${
                      selectedCenter === center.id
                        ? 'bg-white/10 border border-white/20'
                        : 'bg-gray-800/50 border border-transparent hover:bg-gray-800'
                    }`}
                  >
                    <span className="text-sm">{center.icon}</span>
                    <span className="text-gray-300 flex-1 truncate">{center.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: center.color + '20', color: center.color }}>
                      {TYPE_LABELS[center.type]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Select Building */}
            {selectedCenter && (
              <div>
                <p className="text-[10px] text-gray-500 mb-1">2. Haritadan hedef binayı tıklayın</p>
                {selectedBuildingData ? (
                  <div className="bg-gray-800/60 rounded-lg px-3 py-2 text-[11px]">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2.5 h-2.5 rounded-full" style={{
                        backgroundColor: selectedBuildingData.damageCategory === 'YIKIK' ? '#ef4444' :
                          selectedBuildingData.damageCategory === 'AGIR' ? '#f97316' : '#eab308'
                      }} />
                      <span className="text-white font-bold">{selectedBuildingData.damageCategory}</span>
                      <span className="text-gray-500 ml-auto">{selectedBuildingData.district}</span>
                    </div>
                    <div className="text-gray-400 text-[10px]">
                      Öncelik: {selectedBuildingData.priorityScore}/100 · {selectedBuildingData.residents} kişi · {selectedBuildingData.floors} kat
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-gray-600 italic py-2 text-center">
                    Haritada bir binaya tıklayın...
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Dispatch */}
            {selectedCenter && selectedBuilding && (
              <button
                onClick={handleDispatch}
                disabled={dispatchLoading}
                className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider
                  transition-all shadow-lg ${
                    dispatchLoading
                      ? 'bg-gray-700 text-gray-400 cursor-wait shadow-none'
                      : 'bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 shadow-red-500/20 hover:shadow-red-500/40'
                  }`}
              >
                {dispatchLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    OSRM Rota Hesaplanıyor...
                  </span>
                ) : (
                  '🚨 Safe-Route ile Sevk Et'
                )}
              </button>
            )}
          </div>
        )}

        {/* Emergency Centers List */}
        {!routingMode && (
          <div>
            <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-2 font-semibold">Acil Durum Merkezleri</p>
            <div className="space-y-1">
              {emergencyCenters.map((center) => (
                <div key={center.id} className="flex items-center gap-2 px-2.5 py-2 bg-gray-800/40 rounded-lg text-[11px]">
                  <span className="text-sm">{center.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-300 font-semibold truncate">{center.name}</div>
                    <div className="text-[9px] text-gray-600">Kapasite: {center.capacity} ekip</div>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold" style={{ backgroundColor: center.color + '20', color: center.color }}>
                    {TYPE_LABELS[center.type]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Missions */}
        {activeMissions.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-semibold">Aktif Görevler ({activeMissions.length})</p>
              <button
                onClick={clearMissions}
                className="text-[9px] text-red-400 hover:text-red-300 font-semibold"
              >
                Temizle
              </button>
            </div>
            <div className="space-y-1">
              {activeMissions.map((m) => {
                const center = emergencyCenters.find((c) => c.id === m.fromCenter);
                const building = buildings.find((b) => b.id === m.toBuildingId);
                return (
                  <div key={m.id} className="bg-gray-800/40 rounded-lg px-3 py-2 text-[10px]">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                      <span className="text-gray-300 font-semibold">{center?.name?.split(' - ')[0] || ''}</span>
                      <span className="text-gray-600">→</span>
                      <span className="text-gray-400">{building?.district}</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-500">
                      <span>📏 {m.routeDistance} km</span>
                      <span>⏱ {m.routeDuration} dk</span>
                      {m.safeRoute && <span className="text-green-400">✓ OSRM</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
