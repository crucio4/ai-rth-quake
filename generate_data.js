const fs = require('fs');
const turf = require('@turf/turf');

async function main() {
  console.log('Reading boundaries...');
  const geojsonRaw = fs.readFileSync('besiktas_boundaries.geojson', 'utf-8');
  const geojson = JSON.parse(geojsonRaw);
  
  const polygonFeature = geojson.features.find(f => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon');
  
  if (!polygonFeature) {
    console.error('No polygon found in geojson!');
    return;
  }

  const TARGET_COUNT = 10000;
  const buildings = [];
  
  console.log(`Generating ${TARGET_COUNT} buildings inside Beşiktaş...`);
  
  const bbox = turf.bbox(polygonFeature);
  
  let i = 0;
  let idCounter = 1;
  while (buildings.length < TARGET_COUNT) {
    const pt = turf.randomPoint(1, { bbox: bbox }).features[0];
    if (turf.booleanPointInPolygon(pt, polygonFeature)) {
      const [lng, lat] = pt.geometry.coordinates;
      
      // Generate realistic attributes
      const constructionYear = Math.floor(1960 + Math.random() * 63); // 1960 to 2023
      const buildingAge = 2026 - constructionYear;
      const floors = Math.floor(1 + Math.random() * 8); // 1 to 8 floors
      const residents = floors * Math.floor(2 + Math.random() * 5); // 2 to 6 people per floor
      
      // Distance to fault (dummy calculation based on latitude, assume fault is south in Marmara Sea)
      const distanceToFaultKm = Math.max(5, (lat - 40.8) * 111); 
      
      // Assign realistic damage probability based on age and distance
      // Older buildings have higher chance of severe damage
      let damageRoll = Math.random();
      
      // Adjust roll based on age (older = more damage)
      if (buildingAge > 40) damageRoll -= 0.15;
      else if (buildingAge < 10) damageRoll += 0.2;
      
      let damageCategory = 'SAGLAM';
      let damageScore = 0;
      
      // Target Distribution:
      // YIKIK: ~4%
      // AGIR: ~11%
      // ORTA: ~25%
      // HAFIF: ~30%
      // SAGLAM: ~30%
      
      if (damageRoll < 0.04) {
        damageCategory = 'YIKIK';
        damageScore = 3.5 + Math.random() * 0.5; // 3.5 - 4.0
      } else if (damageRoll < 0.15) {
        damageCategory = 'AGIR';
        damageScore = 2.5 + Math.random() * 0.9; // 2.5 - 3.4
      } else if (damageRoll < 0.40) {
        damageCategory = 'ORTA';
        damageScore = 1.5 + Math.random() * 0.9; // 1.5 - 2.4
      } else if (damageRoll < 0.70) {
        damageCategory = 'HAFIF';
        damageScore = 0.5 + Math.random() * 0.9; // 0.5 - 1.4
      } else {
        damageCategory = 'SAGLAM';
        damageScore = Math.random() * 0.4; // 0.0 - 0.4
      }
      
      const b = {
        id: `BJK-${idCounter++}`,
        lat: lat,
        lng: lng,
        district: 'Beşiktaş',
        neighborhood: 'Merkez', // Could be randomized
        structureType: 'BETONARME',
        constructionYear: constructionYear,
        buildingAge: buildingAge,
        floors: floors,
        residents: residents,
        soilType: ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)],
        soilAmplification: 1.0 + Math.random() * 0.5,
        liquefactionRisk: Math.random() * 0.3,
        distanceToFaultKm: distanceToFaultKm,
        qualityScore: Math.random() * 100,
        riskScore: Math.random(),
        buildingArea: 100 + Math.random() * 400,
        postDamageScore: damageScore,
        postDamageCategory: damageCategory
      };
      
      buildings.push(b);
    }
  }
  
  console.log('Writing to buildings.json...');
  fs.writeFileSync('buildings.json', JSON.stringify(buildings, null, 2));
  fs.writeFileSync('public/data/buildings.json', JSON.stringify(buildings, null, 2));
  console.log('Done!');
}

main().catch(console.error);
