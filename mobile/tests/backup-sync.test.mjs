import assert from 'node:assert/strict';
import test from 'node:test';
import { BACKUP_FORMAT, BACKUP_VERSION, createBackupSync } from '../src/services/backup-sync.ts';

function memory(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    storage: {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => { values.set(key, value); },
      removeItem: async (key) => { values.delete(key); },
    },
    values,
  };
}

test('exports supported local keys and imports them without touching unknown data', async () => {
  const watchlist = '[{"id":1,"mediaType":"Movie","title":"Arrival","year":"2016","posterUrl":null}]';
  const source = memory({ '@showtime/watchlist': watchlist, 'unrelated': 'keep' });
  const backup = await createBackupSync(source.storage, () => '2026-09-14T00:00:00.000Z').exportBackup();
  assert.deepEqual(backup, {
    format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: '2026-09-14T00:00:00.000Z',
    data: { '@showtime/watchlist': watchlist },
  });
  const target = memory({ unrelated: 'keep' });
  await createBackupSync(target.storage).importBackup(JSON.stringify(backup));
  assert.equal(target.values.get('@showtime/watchlist'), watchlist);
  assert.equal(target.values.get('unrelated'), 'keep');
});

test('rejects malformed or unsupported backups before writing', async () => {
  const target = memory({ '@showtime/watchlist': 'old' });
  const sync = createBackupSync(target.storage);
  await assert.rejects(sync.importBackup('{broken'), /valid JSON/);
  await assert.rejects(sync.importBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 99, data: {} })), /supported/);
  assert.equal(target.values.get('@showtime/watchlist'), 'old');
});

test('rejects valid JSON whose stored value has the wrong shape', async () => {
  const target = memory({ '@showtime/watchlist': '[]' });
  const backup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: '2026-09-14T00:00:00.000Z',
    data: { '@showtime/watchlist': JSON.stringify({ id: 1 }) },
  };

  await assert.rejects(
    createBackupSync(target.storage).importBackup(JSON.stringify(backup)),
    /invalid data.*watchlist/i,
  );
  assert.equal(target.values.get('@showtime/watchlist'), '[]');
});

test('restores prior storage when an import write fails', async () => {
  const target = memory({ 'showtime.settings.v1': '{"showTrending":false}' });
  let failSettingsWrite = true;
  const storage = {
    ...target.storage,
    async setItem(key, value) {
      if (key === 'showtime.settings.v1' && failSettingsWrite) {
        failSettingsWrite = false;
        throw new Error('disk full');
      }
      target.values.set(key, value);
    },
  };
  const backup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: '2026-09-14T00:00:00.000Z',
    data: {
      '@showtime/watchlist': '[]',
      'showtime.settings.v1': '{"showTrending":true}',
    },
  };

  await assert.rejects(
    createBackupSync(storage).importBackup(JSON.stringify(backup)),
    /restored/i,
  );
  assert.equal(target.values.has('@showtime/watchlist'), false);
  assert.equal(target.values.get('showtime.settings.v1'), '{"showTrending":false}');
});
