/**
 * normalizer.js – Data Normalization Utilities
 * Handles date, value, and text normalization for reconciliation
 */

const NORMALIZER = (() => {

  // ---- Date Normalization ----
  function normalizeDate(dateStr) {
    if (!dateStr) return null;
    const s = String(dateStr).trim();

    // Already ISO
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      return s.slice(0, 10);
    }

    // DD/MM/YYYY, DD-MM-YYYY, or MM/DD/YYYY
    let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (m) {
      const year = m[3].length === 2 ? '20' + m[3] : m[3];
      const part1 = parseInt(m[1]);
      const part2 = parseInt(m[2]);
      // If month (part2) is > 12, assume it's MM/DD/YYYY
      if (part2 > 12 && part1 <= 12) {
        return `${year}-${String(part1).padStart(2,'0')}-${String(part2).padStart(2,'0')}`;
      }
      // Otherwise default to DD/MM/YYYY
      return `${year}-${String(part2).padStart(2,'0')}-${String(part1).padStart(2,'0')}`;
    }

    // Try native parse
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }

    return null;
  }

  function formatDateBR(isoDate) {
    if (!isoDate) return '—';
    const parts = String(isoDate).slice(0, 10).split('-');
    if (parts.length !== 3) return String(isoDate);
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  function daysDiff(dateA, dateB) {
    const a = new Date(dateA);
    const b = new Date(dateB);
    if (isNaN(a) || isNaN(b)) return Infinity;
    return Math.abs(Math.round((a - b) / (1000 * 60 * 60 * 24)));
  }

  // ---- Value Normalization ----
  function normalizeValue(valueStr) {
    if (valueStr === null || valueStr === undefined || valueStr === '') return null;
    if (typeof valueStr === 'number') return valueStr;

    let s = String(valueStr).trim();

    // Remove currency symbols and spaces
    s = s.replace(/R\$\s*/g, '')
         .replace(/USD\s*/g, '')
         .replace(/€\s*/g, '');

    // Handle negative in parentheses: (1.500,00) or (1500.00)
    const negative = /^\(.*\)$/.test(s);
    s = s.replace(/[()]/g, '');

    // Brazilian format: 1.500,00 → 1500.00
    if (/^\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(s.trim())) {
      s = s.replace(/\./g, '').replace(',', '.');
    }
    // US format: 1,500.00 → 1500.00
    else if (/^\d{1,3}(,\d{3})*(\.\d{1,2})?$/.test(s.trim())) {
      s = s.replace(/,/g, '');
    }
    // Just comma as decimal: 1500,00
    else {
      s = s.replace(',', '.').replace(/[^\d.\-]/g, '');
    }

    const val = parseFloat(s);
    if (isNaN(val)) return null;
    return negative ? -val : val;
  }

  function formatCurrency(value) {
    if (value === null || value === undefined) return '—';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  function formatNumber(value, decimals = 2) {
    if (value === null || value === undefined) return '—';
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }

  // ---- Text Normalization ----
  function normalizeText(text) {
    if (!text) return '';
    return String(text)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-zA-Z0-9\s]/g, ' ') // Keep only alphanumeric
      .replace(/\s+/g, ' ')            // Collapse spaces
      .trim()
      .toUpperCase();
  }

  function tokenize(text) {
    const stopwords = new Set([
      'DE', 'DA', 'DO', 'DAS', 'DOS', 'EM', 'NA', 'NO', 'NAS', 'NOS',
      'PARA', 'POR', 'COM', 'SEM', 'REF', 'NF', 'NOTA', 'FISCAL', 'PIX',
      'TED', 'DOC', 'DEBITO', 'CREDITO', 'PAGAMENTO', 'RECEBIMENTO',
      'TRANSFERENCIA', 'DEPOSITO', 'SAQUE', 'A', 'E', 'O', 'AS', 'OS',
      'UM', 'UMA', 'THE', 'OF', 'AND',
    ]);
    return normalizeText(text)
      .split(' ')
      .filter(t => t.length > 1 && !stopwords.has(t));
  }

  // ---- Row normalization ----
  function normalizeRow(row, fieldMap) {
    const mapped = {};
    for (const [standardKey, sourceKey] of Object.entries(fieldMap)) {
      if (sourceKey && row[sourceKey] !== undefined) {
        mapped[standardKey] = row[sourceKey];
      }
    }
    return {
      _raw: row,
      date:   normalizeDate(mapped.date   || mapped.data || mapped.DATA),
      value:  normalizeValue(mapped.value  || mapped.valor || mapped.VALOR),
      desc:   normalizeText(mapped.desc   || mapped.descricao || mapped.DESCRICAO || ''),
      ref:    String(mapped.ref || mapped.documento || mapped.DOCUMENTO || '').trim(),
      origin: mapped.origin || '',
    };
  }

  // ---- Auto-detect columns ----
  function detectColumns(headers) {
    const lc = headers.map(h => normalizeText(h || ''));
    const find = (...patterns) => {
      for (const p of patterns) {
        const idx = lc.findIndex(h => h.includes(p));
        if (idx >= 0) return headers[idx];
      }
      return null;
    };
    return {
      date:  find('DATA', 'DATE', 'DT', 'VENCIMENTO', 'LANCAMENTO'),
      value: find('VALOR', 'VALUE', 'AMOUNT', 'MONTANTE', 'DEBITO', 'CREDITO'),
      desc:  find('DESCRICAO', 'DESCRIPTION', 'HISTORICO', 'MEMO', 'NARRATIVE', 'COMPLEMENTO'),
      ref:   find('DOCUMENTO', 'DOCUMENT', 'REFERENCIA', 'REF', 'ID', 'NUMERO'),
      // Extra fields for N x 1 grouping
      notaFiscal:  find('NOTA FISCAL', 'NF', 'INVOICE', 'NUM NF', 'NFISCAL', 'NFE', 'NOTA'),
      fornecedor:  find('FORNECEDOR', 'SUPPLIER', 'VENDOR', 'FORN', 'RAZAO SOCIAL'),
      centroCusto: find('CENTRO CUSTO', 'CC', 'COST CENTER', 'CENTRO', 'CCUSTO'),
      pedido:      find('PEDIDO', 'ORDER', 'PO', 'NUM PEDIDO', 'ORDEM'),
      cliente:     find('CLIENTE', 'CUSTOMER', 'CLIENT', 'COMPRADOR'),
    };
  }

  return {
    normalizeDate, formatDateBR, daysDiff,
    normalizeValue, formatCurrency, formatNumber,
    normalizeText, tokenize,
    normalizeRow, detectColumns,
  };
})();
