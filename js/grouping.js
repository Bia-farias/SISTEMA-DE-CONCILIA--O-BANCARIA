/**
 * grouping.js – Grouping Engine for N x 1 Reconciliation
 * Groups ERP entries and matches them against bank transactions
 * Includes Subset Sum (backtracking) for entries without a common identifier
 */

const GROUPING = (() => {

  // Default configuration
  const DEFAULTS = {
    groupField: 'ref',           // Field to group by
    maxItemsPerCombo: 15,        // Max items in subset sum combination
    valueTolerance: 0.01,        // Absolute tolerance for value match (R$)
    dateTolerance: 3,            // Days tolerance for date match
    enableSubsetSum: true,       // Enable subset sum when no grouping match
    subsetSumTimeout: 5000,      // Timeout in ms for subset sum per bank row
  };

  // ---- Phase 1: Group ERP rows by a common field ----
  function groupByField(systemRows, field, extraFields = {}) {
    const groups = {};

    for (const row of systemRows) {
      // Determine the grouping key based on field
      let key = null;

      if (field === 'ref' || field === 'documento') {
        key = row.ref || null;
      } else if (field === 'date' || field === 'data') {
        key = row.date || null;
      } else if (field === 'desc' || field === 'descricao') {
        // Extract common prefix from description (first 3 significant words)
        const tokens = (row.desc || '').split(' ').filter(t => t.length > 2).slice(0, 3);
        key = tokens.join(' ') || null;
      } else {
        // Extra field from _extra
        key = row._extra?.[field] || row._raw?.[field] || null;
      }

      // Normalize key
      if (key !== null && key !== undefined && String(key).trim() !== '') {
        key = String(key).trim().toUpperCase();
      } else {
        key = null;
      }

      if (key === null) continue;

      if (!groups[key]) {
        groups[key] = {
          id: `grp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          groupKey: key,
          groupField: field,
          items: [],
          totalValue: 0,
          itemCount: 0,
          date: null,
          document: key,
          status: 'pending',
          bankRowId: null,
          reconciledAt: null,
          reconciledBy: null,
        };
      }

      groups[key].items.push(row);
      groups[key].totalValue += (row.value || 0);
      groups[key].itemCount++;

      // Use most recent date
      if (!groups[key].date || (row.date && row.date > groups[key].date)) {
        groups[key].date = row.date;
      }
    }

    // Round totals and filter out single-item groups (those are handled by 1x1)
    const result = [];
    for (const grp of Object.values(groups)) {
      grp.totalValue = Math.round(grp.totalValue * 100) / 100;
      if (grp.itemCount > 1) {
        result.push(grp);
      }
    }

    return result;
  }

  // ---- Phase 2: Match groups against bank rows ----
  function matchGroups(groups, bankRows, bankUsed, systemUsed, config = {}) {
    const cfg = { ...DEFAULTS, ...config };
    const results = [];
    const matchedGroups = [];

    for (const group of groups) {
      // Skip if any item in the group is already used
      if (group.items.some(item => systemUsed.has(item._id))) continue;

      let bestMatch = null;
      let bestDiff = Infinity;

      for (const bankRow of bankRows) {
        if (bankUsed.has(bankRow._id)) continue;

        // Value comparison (absolute tolerance)
        const valueDiff = Math.abs(group.totalValue - Math.abs(bankRow.value));
        if (valueDiff > cfg.valueTolerance) continue;

        // Date comparison (tolerance in days)
        if (group.date && bankRow.date) {
          const daysDiff = NORMALIZER.daysDiff(group.date, bankRow.date);
          if (daysDiff > cfg.dateTolerance) continue;
        }

        if (valueDiff < bestDiff) {
          bestDiff = valueDiff;
          bestMatch = bankRow;
        }
      }

      if (bestMatch) {
        // Create result for the group
        group.status = 'matched';
        group.bankRowId = bestMatch._id;
        group.reconciledAt = new Date().toISOString();

        // Mark all items as used
        for (const item of group.items) {
          systemUsed.add(item._id);
        }
        bankUsed.add(bestMatch._id);

        results.push({
          id: `res-grp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: 'group',
          bankRow: bestMatch,
          systemRow: null,          // No single system row
          systemRows: group.items,  // Array of grouped system rows
          group: group,
          status: 'CONCILIADO_GRUPO',
          statusLabel: 'Conciliado (Grupo)',
          statusClass: 'badge-group',
          note: `Agrupamento por ${getFieldLabel(group.groupField)}: ${group.groupKey} (${group.itemCount} itens)`,
          manuallyReconciled: false,
          reconciledAt: group.reconciledAt,
          date: bestMatch.date || group.date,
          value: bestMatch.value,
          desc: bestMatch.desc || '',
        });

        matchedGroups.push(group);
      }
    }

    return { results, matchedGroups };
  }

  // ---- Phase 3: Subset Sum (backtracking) ----
  // Find combinations of ERP rows whose values sum to a bank row value

  function buildValueIndex(rows) {
    // Sort rows by absolute value for more efficient pruning
    const indexed = rows.map(r => ({
      ...r,
      absValue: Math.abs(r.value || 0),
    })).sort((a, b) => b.absValue - a.absValue);

    return indexed;
  }

  function findSubsetSumMatches(bankRows, systemRows, bankUsed, systemUsed, config = {}) {
    const cfg = { ...DEFAULTS, ...config };
    const results = [];
    const MAX_ITEMS = cfg.maxItemsPerCombo;
    const VALUE_TOLERANCE = cfg.valueTolerance;

    // Get available system rows (not used, positive and negative separately)
    const availablePositive = systemRows.filter(r =>
      !systemUsed.has(r._id) && r.value !== null && r.value > 0
    );
    const availableNegative = systemRows.filter(r =>
      !systemUsed.has(r._id) && r.value !== null && r.value < 0
    );

    // Get unmatched bank rows
    const unmatchedBank = bankRows.filter(r => !bankUsed.has(r._id) && r.value !== null);

    for (const bankRow of unmatchedBank) {
      const targetValue = Math.abs(bankRow.value);
      if (targetValue <= 0) continue;

      // Choose the right pool based on sign
      const pool = bankRow.value > 0 ? availablePositive : availableNegative;

      // Pre-filter: only rows with |value| <= targetValue
      const candidates = pool.filter(r =>
        !systemUsed.has(r._id) && Math.abs(r.value) <= targetValue + VALUE_TOLERANCE
      ).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

      if (candidates.length === 0) continue;
      if (candidates.length > 200) continue; // Too many to search efficiently

      // Quick check: sum of all candidates must be >= target
      const totalAvailable = candidates.reduce((sum, r) => sum + Math.abs(r.value), 0);
      if (totalAvailable < targetValue - VALUE_TOLERANCE) continue;

      // Run backtracking with timeout
      const startTime = Date.now();
      const bestCombo = [];
      let bestDiff = Infinity;

      function backtrack(idx, currentSum, selected) {
        // Timeout check
        if (Date.now() - startTime > cfg.subsetSumTimeout) return;

        // Check if we found a match
        const diff = Math.abs(currentSum - targetValue);
        if (diff <= VALUE_TOLERANCE && selected.length >= 2) {
          if (diff < bestDiff) {
            bestDiff = diff;
            bestCombo.length = 0;
            bestCombo.push(...selected);
          }
          return; // Found exact match, stop searching deeper
        }

        // Pruning: if we've exceeded the target, stop
        if (currentSum > targetValue + VALUE_TOLERANCE) return;

        // Pruning: if we've reached max items, stop
        if (selected.length >= MAX_ITEMS) return;

        // Pruning: remaining items can't reach target
        let remaining = 0;
        for (let i = idx; i < candidates.length; i++) {
          remaining += Math.abs(candidates[i].value);
        }
        if (currentSum + remaining < targetValue - VALUE_TOLERANCE) return;

        for (let i = idx; i < candidates.length; i++) {
          // Skip duplicates at same recursion level (optimization)
          if (i > idx && Math.abs(candidates[i].value) === Math.abs(candidates[i - 1].value) &&
              candidates[i].desc === candidates[i - 1].desc) continue;

          const val = Math.abs(candidates[i].value);
          selected.push(candidates[i]);
          backtrack(i + 1, currentSum + val, selected);
          selected.pop();

          // Early exit if we found a perfect match
          if (bestDiff <= VALUE_TOLERANCE) return;
        }
      }

      backtrack(0, 0, []);

      if (bestCombo.length >= 2 && bestDiff <= VALUE_TOLERANCE) {
        const totalValue = bestCombo.reduce((s, r) => s + Math.abs(r.value), 0);

        // Create a group from the subset sum result
        const group = {
          id: `grp-ss-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          groupKey: `SOMA-${bankRow._id}`,
          groupField: 'subset_sum',
          items: [...bestCombo],
          totalValue: Math.round(totalValue * 100) / 100,
          itemCount: bestCombo.length,
          date: bestCombo.reduce((d, r) => (!d || (r.date && r.date > d)) ? r.date : d, null),
          document: `Combinação de ${bestCombo.length} itens`,
          status: 'matched',
          bankRowId: bankRow._id,
          reconciledAt: new Date().toISOString(),
          reconciledBy: null,
        };

        // Mark items as used
        for (const item of bestCombo) {
          systemUsed.add(item._id);
        }
        bankUsed.add(bankRow._id);

        // Remove from available pool
        for (const item of bestCombo) {
          const idx = availablePositive.findIndex(r => r._id === item._id);
          if (idx >= 0) availablePositive.splice(idx, 1);
          const idx2 = availableNegative.findIndex(r => r._id === item._id);
          if (idx2 >= 0) availableNegative.splice(idx2, 1);
        }

        results.push({
          id: `res-ss-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: 'group',
          bankRow: bankRow,
          systemRow: null,
          systemRows: bestCombo,
          group: group,
          status: 'CONCILIADO_GRUPO',
          statusLabel: 'Conciliado (Grupo)',
          statusClass: 'badge-group',
          note: `Subset Sum: ${bestCombo.length} itens combinados (diff: ${NORMALIZER.formatCurrency(bestDiff)})`,
          manuallyReconciled: false,
          reconciledAt: group.reconciledAt,
          date: bankRow.date,
          value: bankRow.value,
          desc: bankRow.desc || '',
        });
      }
    }

    return results;
  }

  // ---- Inverse: Group bank rows to match single ERP row (1 x N) ----
  function matchGroupsInverse(groups, systemRows, bankUsed, systemUsed, config = {}) {
    const cfg = { ...DEFAULTS, ...config };
    const results = [];

    for (const group of groups) {
      if (group.items.some(item => bankUsed.has(item._id))) continue;

      let bestMatch = null;
      let bestDiff = Infinity;

      for (const sysRow of systemRows) {
        if (systemUsed.has(sysRow._id)) continue;

        const valueDiff = Math.abs(group.totalValue - Math.abs(sysRow.value));
        if (valueDiff > cfg.valueTolerance) continue;

        if (group.date && sysRow.date) {
          const daysDiff = NORMALIZER.daysDiff(group.date, sysRow.date);
          if (daysDiff > cfg.dateTolerance) continue;
        }

        if (valueDiff < bestDiff) {
          bestDiff = valueDiff;
          bestMatch = sysRow;
        }
      }

      if (bestMatch) {
        group.status = 'matched';
        group.bankRowId = bestMatch._id;
        group.reconciledAt = new Date().toISOString();

        for (const item of group.items) {
          bankUsed.add(item._id);
        }
        systemUsed.add(bestMatch._id);

        results.push({
          id: `res-grp-inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: 'group',
          bankRow: null,
          bankRows: group.items,    // Multiple bank rows
          systemRow: bestMatch,
          systemRows: null,
          group: group,
          status: 'CONCILIADO_GRUPO',
          statusLabel: 'Conciliado (Grupo)',
          statusClass: 'badge-group',
          note: `Agrupamento inverso por ${getFieldLabel(group.groupField)}: ${group.groupKey} (${group.itemCount} itens banco)`,
          manuallyReconciled: false,
          reconciledAt: group.reconciledAt,
          date: bestMatch.date || group.date,
          value: bestMatch.value,
          desc: bestMatch.desc || '',
        });
      }
    }

    return results;
  }

  // ---- Main reconciliation entry point ----
  async function reconcileGrouped(bankRows, systemRows, config = {}, onProgress = () => {}) {
    const cfg = { ...DEFAULTS, ...config };
    const reconType = cfg.reconciliationType || '1x1';
    const results = [];
    const bankUsed = new Set();
    const systemUsed = new Set();
    const allGroups = [];

    // ======== N x 1: Group ERP, match to bank ========
    if (reconType === 'Nx1' || reconType === 'NxN') {
      onProgress(5, 'Agrupando lançamentos do ERP...');
      await sleep(200);

      // Phase 1: Group by field
      const erpGroups = groupByField(systemRows, cfg.groupField);
      allGroups.push(...erpGroups);

      onProgress(15, `${erpGroups.length} grupo(s) encontrado(s). Conciliando...`);
      await sleep(200);

      // Phase 2: Match groups to bank
      const groupResult = matchGroups(erpGroups, bankRows, bankUsed, systemUsed, cfg);
      results.push(...groupResult.results);

      onProgress(25, `${groupResult.matchedGroups.length} grupo(s) conciliado(s). Buscando combinações...`);
      await sleep(200);

      // Phase 3: Subset Sum for unmatched bank rows
      if (cfg.enableSubsetSum) {
        const ssResults = findSubsetSumMatches(bankRows, systemRows, bankUsed, systemUsed, cfg);
        results.push(...ssResults);
        onProgress(35, `Subset Sum: ${ssResults.length} combinação(ões) encontrada(s).`);
        await sleep(150);
      }
    }

    // ======== 1 x N: Group bank, match to ERP ========
    if (reconType === '1xN' || reconType === 'NxN') {
      onProgress(reconType === 'NxN' ? 38 : 5, 'Agrupando lançamentos bancários...');
      await sleep(200);

      const bankGroups = groupByField(bankRows, cfg.groupField);
      allGroups.push(...bankGroups);

      onProgress(reconType === 'NxN' ? 42 : 15, `${bankGroups.length} grupo(s) bancário(s). Conciliando...`);
      await sleep(200);

      const invResult = matchGroupsInverse(bankGroups, systemRows, bankUsed, systemUsed, cfg);
      results.push(...invResult);

      if (cfg.enableSubsetSum) {
        // Inverse subset sum: find bank combinations matching system rows
        const ssInvResults = findSubsetSumMatches(systemRows, bankRows, systemUsed, bankUsed, cfg);
        results.push(...ssInvResults);
      }

      onProgress(reconType === 'NxN' ? 45 : 35, 'Agrupamento inverso concluído.');
      await sleep(150);
    }

    return { results, bankUsed, systemUsed, groups: allGroups };
  }

  // ---- Helper: field labels ----
  function getFieldLabel(field) {
    const labels = {
      ref: 'Documento',
      documento: 'Documento',
      date: 'Data',
      data: 'Data',
      desc: 'Descrição',
      descricao: 'Descrição',
      notaFiscal: 'Nota Fiscal',
      fornecedor: 'Fornecedor',
      centroCusto: 'Centro de Custo',
      pedido: 'Pedido',
      cliente: 'Cliente',
      subset_sum: 'Combinação de Valores',
    };
    return labels[field] || field;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  return {
    groupByField,
    matchGroups,
    findSubsetSumMatches,
    matchGroupsInverse,
    reconcileGrouped,
    getFieldLabel,
    DEFAULTS,
  };
})();
