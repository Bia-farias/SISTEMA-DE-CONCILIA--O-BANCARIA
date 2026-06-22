/**
 * engine.js – Reconciliation Engine
 * Runs all matching strategies and produces a full result set
 */

const ENGINE = (() => {

  // Status constants
  const STATUS = {
    CONCILIADO:           'CONCILIADO',
    CONCILIADO_DATA:      'CONCILIADO_DATA',
    PROVAVEL:             'PROVAVEL',
    DIV_VALOR:            'DIV_VALOR',
    NAO_REGISTRADO:       'NAO_REGISTRADO',
    NAO_COMPENSADO:       'NAO_COMPENSADO',
    DUPLICIDADE:          'DUPLICIDADE',
  };

  const STATUS_LABELS = {
    CONCILIADO:       'Conciliado',
    CONCILIADO_DATA:  'Conciliado c/ Divergência de Data',
    PROVAVEL:         'Provável Correspondência',
    DIV_VALOR:        'Divergência de Valor',
    NAO_REGISTRADO:   'Não Registrado',
    NAO_COMPENSADO:   'Não Compensado',
    DUPLICIDADE:      'Duplicidade',
  };

  const STATUS_CSS_CLASS = {
    CONCILIADO:      'badge-success',
    CONCILIADO_DATA: 'badge-warning',
    PROVAVEL:        'badge-brand',
    DIV_VALOR:       'badge-pending',
    NAO_REGISTRADO:  'badge-danger',
    NAO_COMPENSADO:  'badge-info',
    DUPLICIDADE:     'badge-secondary',
  };

  // ---- Helper ----
  function sameValue(a, b) {
    return a !== null && b !== null && Math.abs(a - b) < 0.01;
  }

  function valueWithinPct(a, b, pct) {
    if (!a || !b) return false;
    const diff = Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b));
    return diff <= pct / 100;
  }

  // ---- Step 1: Find duplicates in a dataset ----
  function findDuplicates(rows) {
    const seen = {};
    const dupeIds = new Set();
    for (const row of rows) {
      const key = `${row.date}_${row.value}_${row.desc?.slice(0, 20)}`;
      if (seen[key] !== undefined) {
        dupeIds.add(row._id);
        dupeIds.add(seen[key]);
      } else {
        seen[key] = row._id;
      }
    }
    return dupeIds;
  }

  // ---- Main reconciliation function ----
  async function reconcile(bankRows, systemRows, config = {}, onProgress = () => {}) {
    const cfg = {
      dateTolerance: 3,
      valueTolerance: 0.5,
      enableSimilarity: true,
      enableAI: true,
      ...config,
    };

    const results = [];
    const bankUsed    = new Set();
    const systemUsed  = new Set();

    onProgress(5, 'Verificando duplicidades...');
    await sleep(100);

    // --- Phase 0: Detect duplicates ---
    const bankDupes   = findDuplicates(bankRows);
    const systemDupes = findDuplicates(systemRows);

    for (const id of bankDupes) {
      const row = bankRows.find(r => r._id === id);
      if (row) {
        results.push(makeResult(row, null, STATUS.DUPLICIDADE, 'Duplicidade encontrada no extrato bancário'));
        bankUsed.add(id);
      }
    }
    for (const id of systemDupes) {
      const row = systemRows.find(r => r._id === id);
      if (row) {
        results.push(makeResult(null, row, STATUS.DUPLICIDADE, 'Duplicidade encontrada no sistema'));
        systemUsed.add(id);
      }
    }

    onProgress(20, 'Conciliação exata (valor + data)...');
    await sleep(150);

    // --- Phase 1: Exact match (same value + same date) ---
    for (const bankRow of bankRows) {
      if (bankUsed.has(bankRow._id)) continue;
      for (const sysRow of systemRows) {
        if (systemUsed.has(sysRow._id)) continue;
        if (sameValue(bankRow.value, sysRow.value) && bankRow.date === sysRow.date) {
          results.push(makeResult(bankRow, sysRow, STATUS.CONCILIADO));
          bankUsed.add(bankRow._id);
          systemUsed.add(sysRow._id);
          break;
        }
      }
    }

    onProgress(40, 'Conciliação por tolerância de data...');
    await sleep(150);

    // --- Phase 2: Date tolerance (same value, date within N days) ---
    for (const bankRow of bankRows) {
      if (bankUsed.has(bankRow._id)) continue;
      let bestMatch = null;
      let bestDiff  = Infinity;
      for (const sysRow of systemRows) {
        if (systemUsed.has(sysRow._id)) continue;
        if (sameValue(bankRow.value, sysRow.value)) {
          const diff = NORMALIZER.daysDiff(bankRow.date, sysRow.date);
          if (diff <= cfg.dateTolerance && diff < bestDiff) {
            bestMatch = sysRow;
            bestDiff  = diff;
          }
        }
      }
      if (bestMatch) {
        results.push(makeResult(bankRow, bestMatch, STATUS.CONCILIADO_DATA,
          `Diferença de ${bestDiff} dia(s)`));
        bankUsed.add(bankRow._id);
        systemUsed.add(bestMatch._id);
      }
    }

    onProgress(60, 'Conciliação por similaridade de texto...');
    await sleep(150);

    // --- Phase 3: Similarity (same value, similar description) ---
    if (cfg.enableSimilarity) {
      for (const bankRow of bankRows) {
        if (bankUsed.has(bankRow._id)) continue;
        let bestMatch   = null;
        let bestSimScore = 0;
        for (const sysRow of systemRows) {
          if (systemUsed.has(sysRow._id)) continue;
          if (sameValue(bankRow.value, sysRow.value)) {
            const sim = AI_ENGINE.textSimilarity(bankRow.desc, sysRow.desc);
            if (sim > 0.45 && sim > bestSimScore) {
              bestMatch   = sysRow;
              bestSimScore = sim;
            }
          }
        }
        if (bestMatch) {
          results.push(makeResult(bankRow, bestMatch, STATUS.PROVAVEL,
            `Similaridade de texto: ${Math.round(bestSimScore * 100)}%`));
          bankUsed.add(bankRow._id);
          systemUsed.add(bestMatch._id);
        }
      }
    }

    onProgress(75, 'Verificando divergências de valor...');
    await sleep(100);

    // --- Phase 4: Value range (small value difference) ---
    for (const bankRow of bankRows) {
      if (bankUsed.has(bankRow._id)) continue;
      let bestMatch = null;
      let bestDiff  = Infinity;
      for (const sysRow of systemRows) {
        if (systemUsed.has(sysRow._id)) continue;
        if (bankRow.value !== null && sysRow.value !== null) {
          const diff = Math.abs(bankRow.value - sysRow.value);
          const pctDiff = diff / Math.max(Math.abs(bankRow.value), Math.abs(sysRow.value || 1)) * 100;
          if (pctDiff <= cfg.valueTolerance + 5 && bankRow.date === sysRow.date && diff < bestDiff) {
            bestMatch = sysRow;
            bestDiff  = diff;
          }
        }
      }
      if (bestMatch) {
        const diff = Math.abs(bankRow.value - bestMatch.value);
        results.push(makeResult(bankRow, bestMatch, STATUS.DIV_VALOR,
          `Diferença de ${NORMALIZER.formatCurrency(diff)}`));
        bankUsed.add(bankRow._id);
        systemUsed.add(bestMatch._id);
      }
    }

    onProgress(88, 'Identificando lançamentos sem par...');
    await sleep(100);

    // --- Phase 5: Not found in system (in bank, not in system) ---
    for (const bankRow of bankRows) {
      if (!bankUsed.has(bankRow._id)) {
        results.push(makeResult(bankRow, null, STATUS.NAO_REGISTRADO,
          'Lançamento bancário sem correspondência no sistema'));
      }
    }

    // --- Phase 6: Not compensated (in system, not in bank) ---
    for (const sysRow of systemRows) {
      if (!systemUsed.has(sysRow._id)) {
        results.push(makeResult(null, sysRow, STATUS.NAO_COMPENSADO,
          'Lançamento no sistema sem correspondência no banco'));
      }
    }

    onProgress(95, 'Calculando IA e sugestões...');
    await sleep(100);

    // --- Phase 7: AI suggestions for unmatched ---
    let aiSuggestions = [];
    if (cfg.enableAI) {
      const unmatchedBank   = bankRows.filter(r => !bankUsed.has(r._id) ||
        results.some(res => res.bankRow?._id === r._id && res.status === STATUS.NAO_REGISTRADO));
      const unmatchedSystem = systemRows.filter(r => !systemUsed.has(r._id) ||
        results.some(res => res.systemRow?._id === r._id && res.status === STATUS.NAO_COMPENSADO));

      aiSuggestions = AI_ENGINE.findSuggestions(unmatchedBank, unmatchedSystem, cfg);
    }

    onProgress(100, 'Conciliação concluída!');

    // --- Build summary ---
    const summary = buildSummary(results, bankRows, systemRows);

    return { results, summary, aiSuggestions, config: cfg };
  }

  // ---- Helper: make result object ----
  function makeResult(bankRow, sysRow, status, note = '') {
    return {
      id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      bankRow:    bankRow || null,
      systemRow:  sysRow || null,
      status,
      statusLabel: STATUS_LABELS[status],
      statusClass: STATUS_CSS_CLASS[status],
      note,
      manuallyReconciled: false,
      reconciledAt: null,
      date:  bankRow?.date  || sysRow?.date  || null,
      value: bankRow?.value !== null ? bankRow?.value : sysRow?.value ?? null,
      desc:  bankRow?.desc  || sysRow?.desc  || '',
    };
  }

  // ---- Build summary stats ----
  function buildSummary(results, bankRows, systemRows) {
    const counts = {};
    let valorConciliado = 0;
    let valorPendente   = 0;

    for (const key of Object.values(STATUS)) counts[key] = 0;
    for (const r of results) {
      counts[r.status] = (counts[r.status] || 0) + 1;
      const val = Math.abs(r.value || 0);
      if (r.status === STATUS.CONCILIADO || r.status === STATUS.CONCILIADO_DATA) {
        valorConciliado += val;
      } else if (r.status === STATUS.NAO_REGISTRADO || r.status === STATUS.NAO_COMPENSADO) {
        valorPendente += val;
      }
    }

    const total = results.length;
    const conciliados = (counts[STATUS.CONCILIADO] || 0) + (counts[STATUS.CONCILIADO_DATA] || 0);

    return {
      total,
      conciliado:             counts[STATUS.CONCILIADO]      || 0,
      conciliadoData:         counts[STATUS.CONCILIADO_DATA]  || 0,
      provavelCorrespondencia:counts[STATUS.PROVAVEL]         || 0,
      divergenciaValor:       counts[STATUS.DIV_VALOR]        || 0,
      naoRegistrado:          counts[STATUS.NAO_REGISTRADO]   || 0,
      naoCompensado:          counts[STATUS.NAO_COMPENSADO]   || 0,
      duplicidade:            counts[STATUS.DUPLICIDADE]      || 0,
      totalBank:              bankRows.length,
      totalSystem:            systemRows.length,
      percentual:             total > 0 ? Math.round((conciliados / total) * 100) : 0,
      valorConciliado,
      valorPendente,
    };
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  return {
    reconcile,
    STATUS,
    STATUS_LABELS,
    STATUS_CSS_CLASS,
    buildSummary,
  };
})();
