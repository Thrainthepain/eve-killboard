// tests/reportProcessorService.test.js
// Unit tests for reportProcessorService using Jest

const { processRawKillmail } = require('../services/reportProcessorService');

describe('processRawKillmail', () => {
  it('should correctly aggregate friendly and enemy losses', () => {
    const raw = {
      metadata: { title: 'Test Battle', system: 'Jita', time: '2025-05-11T12:00:00Z' },
      attackers: [
        { ship_type: 'Rifter', value: 1000 },
        { ship_type: 'Rifter', value: 2000 }
      ],
      defenders: [
        { ship_type: 'Merlin', value: 1500 },
      ],
      events: ['Explosion at 12:01']
    };

    const report = processRawKillmail(raw, null);

    expect(report.reportTitle).toBe('Test Battle');
    expect(report.systemName).toBe('Jita');
    expect(report.totalValueDestroyed).toBe(4500);

    // Enemy side is attackers
    expect(report.enemy.total_isk_lost).toBe(3000);
    expect(report.enemy.ships).toEqual([{ type: 'Rifter', count: 2 }]);

    // Friendly side is defenders
    expect(report.friendly.total_isk_lost).toBe(1500);
    expect(report.friendly.ships).toEqual([{ type: 'Merlin', count: 1 }]);

    expect(report.keyEvents).toEqual(['Explosion at 12:01']);
  });
});
