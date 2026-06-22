/**
 * ai.js – AI Similarity Matching & Confidence Scoring
 * Uses Levenshtein distance + token overlap (no external API)
 */

const AI_ENGINE = (() => {

  // ---- Levenshtein Distance ----
  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a) return b.length;
    if (!b) return a.length;

    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        matrix[i][j] = b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(
              matrix[i - 1][j - 1] + 1,
              Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
            );
      }
    }
    return matrix[b.length][a.length];
  }

  // ---- String Similarity (0-1) ----
  function stringSimilarity(a, b) {
    if (!a && !b) return 1;
    if (!a || !b) return 0;
    // Limitar a 100 caracteres para performance
    const _a = a.toUpperCase().slice(0, 100);
    const _b = b.toUpperCase().slice(0, 100);
    const dist = levenshtein(_a, _b);
    const maxLen = Math.max(_a.length, _b.length);
    return 1 - dist / maxLen;
  }

  // ---- Token Overlap Score (0-1) ----
  function tokenOverlap(tokensA, tokensB) {
    if (!tokensA.length && !tokensB.length) return 1;
    if (!tokensA.length || !tokensB.length) return 0;
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    let common = 0;
    for (const t of setA) {
      if (setB.has(t)) common++;
    }
    return common / Math.max(setA.size, setB.size);
  }

  // ---- Combined text similarity ----
  function textSimilarity(descA, descB) {
    const tokensA = NORMALIZER.tokenize(descA);
    const tokensB = NORMALIZER.tokenize(descB);
    const levenSim = stringSimilarity(
      NORMALIZER.normalizeText(descA),
      NORMALIZER.normalizeText(descB)
    );
    const tokenSim = tokenOverlap(tokensA, tokensB);
    // Weighted average
    return levenSim * 0.4 + tokenSim * 0.6;
  }

  // ---- Value closeness (0-1) ----
  function valueSimilarity(valA, valB, tolerancePct = 2) {
    if (valA === null || valB === null) return 0;
    if (valA === 0 && valB === 0) return 1;
    const maxVal = Math.max(Math.abs(valA), Math.abs(valB));
    const diff = Math.abs(valA - valB);
    const pct = (diff / maxVal) * 100;
    if (pct <= tolerancePct) return 1 - pct / tolerancePct * 0.2;
    return Math.max(0, 1 - pct / 100);
  }

  // ---- Date closeness (0-1) ----
  function dateSimilarity(dateA, dateB, maxDays = 7) {
    const diff = NORMALIZER.daysDiff(dateA, dateB);
    if (diff === 0) return 1;
    if (diff <= 3) return 0.85;
    if (diff <= maxDays) return 0.6;
    return Math.max(0, 0.5 - diff * 0.05);
  }

  // ---- Confidence calculation ----
  function calculateConfidence(bankRow, systemRow, config = {}) {
    const dateSim  = dateSimilarity(bankRow.date, systemRow.date, config.maxDays || 7);
    const valSim   = valueSimilarity(bankRow.value, systemRow.value, config.valueTolerance || 2);
    const textSim  = textSimilarity(bankRow.desc || '', systemRow.desc || '');

    // Same value is critical
    const exactValue = Math.abs((bankRow.value || 0) - (systemRow.value || 0)) < 0.01;
    const exactDate  = bankRow.date === systemRow.date;

    let confidence;

    if (exactValue && exactDate) {
      confidence = 0.95 + textSim * 0.05;
    } else if (exactValue) {
      confidence = 0.7 + dateSim * 0.15 + textSim * 0.15;
    } else {
      confidence = valSim * 0.5 + dateSim * 0.2 + textSim * 0.3;
    }

    // Boost for ref match
    if (bankRow.ref && systemRow.ref && bankRow.ref === systemRow.ref) {
      confidence = Math.min(1, confidence + 0.1);
    }

    // Check learned patterns
    const patterns = STORAGE.getAIPatterns();
    const learnedBoost = patterns.some(p =>
      textSimilarity(p.bankDesc, bankRow.desc) > 0.85 &&
      textSimilarity(p.systemDesc, systemRow.desc) > 0.85
    ) ? 0.05 : 0;

    return Math.min(1, Math.max(0, confidence + learnedBoost));
  }

  // ---- Find AI suggestions ----
  function findSuggestions(unmatchedBank, unmatchedSystem, config = {}) {
    const suggestions = [];
    const MIN_CONFIDENCE = 0.55;

    for (const bankRow of unmatchedBank) {
      const candidates = [];

      for (const sysRow of unmatchedSystem) {
        const conf = calculateConfidence(bankRow, sysRow, config);
        if (conf >= MIN_CONFIDENCE) {
          candidates.push({ systemRow: sysRow, confidence: conf });
        }
      }

      // Pick best match
      candidates.sort((a, b) => b.confidence - a.confidence);
      if (candidates.length > 0) {
        const best = candidates[0];
        suggestions.push({
          id: `sug-${bankRow._id}-${best.systemRow._id}`,
          bankRow,
          systemRow: best.systemRow,
          confidence: best.confidence,
          confidencePct: Math.round(best.confidence * 100),
          status: best.confidence >= 0.9
            ? 'AUTO'     // Auto-suggest
            : 'MANUAL',  // Needs review
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Sort by confidence desc
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  // ---- Learn from confirmed match ----
  function learnMatch(bankRow, systemRow) {
    STORAGE.saveAIPattern({
      bankDesc: bankRow.desc,
      systemDesc: systemRow.desc,
      bankValue: bankRow.value,
      systemValue: systemRow.value,
    });
  }

  // ---- Format confidence for display ----
  function confidenceColor(pct) {
    if (pct >= 90) return '#10b981';
    if (pct >= 75) return '#f59e0b';
    if (pct >= 60) return '#f97316';
    return '#ef4444';
  }

  return {
    calculateConfidence,
    findSuggestions,
    learnMatch,
    textSimilarity,
    valueSimilarity,
    dateSimilarity,
    confidenceColor,
  };
})();
