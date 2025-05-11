// services/reportProcessorService.js
// Core logic for generating battle reports from ESI or zKillboard data

const esiService = require('./esiService');
const zkbService = require('./zkbService');

/**
 * Generates a report using the authenticated user's recent SSO killmail.
 *
 * @param {object} params - Parameters from frontend, including ssoReferenceId
 * @param {object} eveSession - Session object containing accessToken and character info
 * @returns {Promise<object>} - Processed report data
 */
async function generateSSOReport(params, eveSession) {
  const { ssoReferenceId } = params;
  const { accessToken, character } = eveSession;

  // Fetch the raw killmail from ESI using killmail ID and character context
  const rawKillmail = await esiService.getKillmailById(
    ssoReferenceId,
    accessToken,
    character.id
  );

  // Transform into structured report
  return processRawKillmail(rawKillmail, character.id);
}

/**
 * Generates a public report using a zKillboard URL or manual details.
 *
 * @param {object} params - Parameters from frontend, including zkbUrl or manual inputs
 * @returns {Promise<object>} - Processed report data
 */
async function generatePublicReport(params) {
  let rawData;

  if (params.dataSourceType === 'sso_zkb_url' || params.dataSourceType === 'manual_zkb_url') {
    rawData = await zkbService.getBattleReportByUrl(params.zkbUrl);
  } else if (params.dataSourceType === 'manual_details') {
    rawData = {
      metadata: {
        title: params.reportTitle || 'Manual Battle',
        system: params.manualSystem,
        time: `${params.manualDate}T${params.manualTime}Z`
      },
      attackers: params.attackers || [],
      defenders: params.defenders || [],
      events: params.events || []
    };
  } else {
    throw new Error(`Unsupported dataSourceType: ${params.dataSourceType}`);
  }

  // No viewer context for public reports
  return processRawKillmail(rawData, null);
}

/**
 * Shared processing logic: transforms raw killmail-like data into frontend-friendly report format.
 *
 * @param {object} raw - Raw killmail or battle report data
 * @param {number|null} viewerCharacterId - If provided, identifies friendly vs. enemy
 * @returns {object} - Structured report data for frontend
 */
function processRawKillmail(raw, viewerCharacterId) {
  const reportTitle = raw.metadata?.title || 'Battle Report';
  const battleTime = raw.metadata?.time || new Date().toISOString();
  const systemName = raw.metadata?.system || 'Unknown';

  // Determine participants based on raw structure
  let attackers = raw.attackers || raw.attackers_list || [];
  let defenders = raw.defenders || raw.defenders_list || [];

  // Map participants to unified format
  const participants = [];
  attackers.forEach(p => participants.push({ ...p, side: 'enemy' }));
  defenders.forEach(p => participants.push({ ...p, side: 'friendly' }));

  const friendly = { name: 'Friendly', total_isk_lost: 0, ships: [], sectionClass: 'section-friendly' };
  const enemy = { name: 'Enemy', total_isk_lost: 0, ships: [], sectionClass: 'section-enemy' };

  participants.forEach(p => {
    const sideGroup = p.side === 'friendly' ? friendly : enemy;
    const value = p.value || p.loss_value || 0;
    sideGroup.total_isk_lost += value;

    const shipType = p.ship_type || p.shipType || 'Unknown';
    let shipEntry = sideGroup.ships.find(s => s.type === shipType);
    if (shipEntry) {
      shipEntry.count += 1;
    } else {
      sideGroup.ships.push({ type: shipType, count: 1 });
    }
  });

  const totalFriendly = friendly.total_isk_lost;
  const totalEnemy = enemy.total_isk_lost;
  const efficiency = totalEnemy > 0 ? totalFriendly / totalEnemy : 0;
  const enemyEfficiency = totalFriendly > 0 ? totalEnemy / totalFriendly : 0;

  return {
    reportTitle,
    battleTime,
    systemName,
    totalValueDestroyed: totalFriendly + totalEnemy,
    efficiency: parseFloat(efficiency.toFixed(2)),
    enemyEfficiency: parseFloat(enemyEfficiency.toFixed(2)),
    friendly,
    enemy,
    keyEvents: raw.events || []
  };
}

module.exports = { generateSSOReport, generatePublicReport };
