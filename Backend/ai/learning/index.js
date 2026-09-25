// Wires the learning pieces together for the running server.
const { createStatsStore } = require('./statsStore');
const { createBillListener } = require('./billListener');
const { rebuildBusiness, startNightlyRebuild } = require('./rebuild');
const { createRanking } = require('./ranker');
const { addPick } = require('./statsModel');

function createLearning({ catalogCache }) {
  const statsStore = createStatsStore();
  const rebuild = (businessId) => rebuildBusiness(businessId, { statsStore });
  const billListener = createBillListener({ statsStore, getCatalog: (id) => catalogCache.get(id), rebuild });

  return {
    statsStore,
    billListener,
    rebuild,
    // Ranking for one command. Never throws: missing stats just means no bonuses.
    async rankingFor(businessId) {
      billListener.touch(businessId);
      try {
        return createRanking({ stats: await statsStore.get(businessId) });
      } catch (err) {
        console.error('aiStats load failed:', err.message);
        return null;
      }
    },
    recordPick(businessId, spokenName, productId) {
      return statsStore.mutate(businessId, (stats) => addPick(stats, spokenName, productId)).catch((err) => console.error('aiStats pick failed:', err.message));
    },
    startJobs() {
      return startNightlyRebuild({ statsStore });
    },
  };
}

module.exports = { createLearning };
