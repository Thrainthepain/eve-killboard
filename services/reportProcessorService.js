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

  // Fetch the raw killmail from ESI
  const rawKillmail = await esiService.getKillmailById(ssoReferenceId, accessToken);

  // Process and aggregate into report structure
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

  // Determine source
  if (params.dataSourceType === 'sso_zkb_url' || params.dataSourceType === 'manual_zkb_url') {
    rawData = await zkbService.getBattleReportByUrl(params.zkbUrl);
  } else if (params.dataSourceType === 'manual_details') {
    // Assemble manual killmail-like object from user input
    rawData = {
      metadata: {
        system: params.manualSystem,
        time: `${params.manualDate}T${params.manualTime}Z`
      },
      attackers: params.attackers || [],
      defenders: params.defenders || []
    };
  } else {
    throw new Error(`Unsupported dataSourceType: ${params.dataSourceType}`);
  }

  // Process and aggregate into report structure
  return processRawKillmail(rawData, null);
}

/**
 * Shared processing logic: transforms raw killmail-like data into frontend-friendly report format.
 *
 * @param {object} raw - Raw killmail or battle report data
 * @param {number|null} viewerCharacterId - If provided, used to identify friendly vs enemy
 * @returns {object} - Structured report data for frontend
 */
function processRawKillmail(raw, viewerCharacterId) {
  // Extract metadata
  const reportTitle = raw.metadata?.title || 'Battle Report';
  const battleTime = raw.metadata?.time || new Date().toISOString();
  const systemName = raw.metadata?.system || 'Unknown';

  // Flatten participants
  const participants = [];
  if (raw.attackers) participants.push(...raw.attackers.map(p => ({ ...p, side: 'enemy' })));
  if (raw.defenders) participants.push(...raw.defenders.map(p => ({ ...p, side: 'friendly' })));

  // Determine sides
  const friendly = { name: 'Friendly', total_isk_lost: 0, ships: [], sectionClass: 'section-friendly' };
  const enemy = { name: 'Enemy', total_isk_lost: 0, ships: [], sectionClass: 'section-enemy' };

  participants.forEach(p => {
    const target = p.side === 'friendly' ? friendly : enemy;
    // Accumulate ISK values
    target.total_isk_lost += p.value || 0;
    // Group ships
    const shipEntry = target.ships.find(s => s.type === p.ship_type);
    if (shipEntry) {
      shipEntry.count += 1;
    } else {
      target.ships.push({ type: p.ship_type, count: 1 });
    }
  });

  // Calculate efficiency (simple example)
  const totalFriendly = friendly.total_isk_lost;
  const totalEnemy = enemy.total_isk_lost;
  const efficiency = totalEnemy > 0 ? (totalFriendly / totalEnemy).toFixed(2) : 0;
  const enemyEfficiency = totalFriendly > 0 ? (totalEnemy / totalFriendly).toFixed(2) : 0;

  // Key events placeholder
  const keyEvents = raw.events || [];

  return {
    reportTitle,
    battleTime,
    systemName,
    totalValueDestroyed: totalFriendly + totalEnemy,
    efficiency: parseFloat(efficiency),
    enemyEfficiency: parseFloat(enemyEfficiency),
    friendly,
    enemy,
    keyEvents
  };
}

module.exports = {
  generateSSOReport,
  generatePublicReport
};
