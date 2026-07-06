/**
 * parser.js – File Parsers: CSV, XLSX, OFX
 * Depends on: PapaParse, SheetJS (xlsx), NORMALIZER
 */

const PARSER = (() => {

  // ---- CSV Parser (via PapaParse) ----
  async function parseCSV(file) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: 'UTF-8',
        complete: (results) => {
          if (results.errors.length > 0 && results.data.length === 0) {
            reject(new Error('Erro ao parsear CSV: ' + results.errors[0].message));
            return;
          }
          const headers = results.meta.fields || [];
          resolve({ headers, rows: results.data, errors: results.errors });
        },
        error: (err) => reject(err),
      });
    });
  }

  // ---- XLSX Parser (via SheetJS) ----
  async function parseXLSX(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array', cellDates: false });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
          const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
          resolve({ headers, rows, errors: [] });
        } catch (err) {
          reject(new Error('Erro ao parsear XLSX: ' + err.message));
        }
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));
      reader.readAsArrayBuffer(file);
    });
  }

  // ---- OFX Parser (native) ----
  async function parseOFX(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target.result;
          const rows = [];

          // Try XML-based OFX first
          if (content.includes('<OFX>') || content.includes('<ofx>')) {
            const parser = new DOMParser();
            let xmlStr = content.includes('<?xml') ? content : '<?xml version="1.0"?>' + content;
            xmlStr = xmlStr.replace(/&(?!(amp|lt|gt|quot|apos);)/ig, '&amp;');
            try {
              const doc = parser.parseFromString(xmlStr, 'text/xml');
              const transactions = doc.querySelectorAll('STMTTRN');
              transactions.forEach(tx => {
                const get = (tag) => tx.querySelector(tag)?.textContent?.trim() || '';
                rows.push({
                  DATA:      get('DTPOSTED') || get('DTUSER'),
                  VALOR:     get('TRNAMT'),
                  DESCRICAO: get('MEMO') || get('NAME'),
                  DOCUMENTO: get('FITID'),
                  TIPO:      get('TRNTYPE'),
                });
              });
            } catch {
              // Fall through to text-based parsing
            }
          }

          // Text-based OFX (SGML)
          if (rows.length === 0) {
            const blocks = content.split(/<STMTTRN>/i).slice(1);
            for (const block of blocks) {
              const endBlock = block.split(/<\/STMTTRN>/i)[0];
              const getLine = (tag) => {
                const m = endBlock.match(new RegExp(`<${tag}>([^\r\n<]+)`, 'i'));
                return m ? m[1].trim() : '';
              };
              rows.push({
                DATA:      getLine('DTPOSTED') || getLine('DTUSER'),
                VALOR:     getLine('TRNAMT'),
                DESCRICAO: getLine('MEMO') || getLine('NAME'),
                DOCUMENTO: getLine('FITID'),
                TIPO:      getLine('TRNTYPE'),
              });
            }
          }

          // Normalize OFX dates (YYYYMMDD → YYYY-MM-DD)
          rows.forEach(r => {
            if (r.DATA && /^\d{8}/.test(r.DATA)) {
              const d = r.DATA;
              r.DATA = `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
            }
          });

          const headers = ['DATA', 'VALOR', 'DESCRICAO', 'DOCUMENTO', 'TIPO'];
          resolve({ headers, rows: rows.filter(r => r.VALOR), errors: [] });
        } catch (err) {
          reject(new Error('Erro ao parsear OFX: ' + err.message));
        }
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo OFX.'));
      reader.readAsText(file, 'latin1');
    });
  }

  // ---- Main entry point ----
  async function parseFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    let result;

    if (ext === 'csv') {
      result = await parseCSV(file);
    } else if (ext === 'xlsx' || ext === 'xls') {
      result = await parseXLSX(file);
    } else if (ext === 'ofx' || ext === 'qfx') {
      result = await parseOFX(file);
    } else {
      throw new Error(`Formato não suportado: .${ext}`);
    }

    // Auto-detect columns
    const colMap = NORMALIZER.detectColumns(result.headers);

    // Normalize rows
    const normalized = result.rows.map((row, idx) => {
      const norm = {
        _id: idx,
        _raw: row,
        date:  NORMALIZER.normalizeDate(row[colMap.date] || row['DATA'] || row['data']),
        value: NORMALIZER.normalizeValue(row[colMap.value] || row['VALOR'] || row['valor']),
        desc:  NORMALIZER.normalizeText(row[colMap.desc] || row['DESCRICAO'] || row['descricao'] || ''),
        ref:   String(row[colMap.ref] || row['DOCUMENTO'] || row['documento'] || '').trim(),
        // Extra fields for N x 1 grouping
        _extra: {},
      };

      // Collect extra grouping fields
      const extraFields = ['notaFiscal', 'fornecedor', 'centroCusto', 'pedido', 'cliente'];
      for (const field of extraFields) {
        const colName = colMap[field];
        if (colName && row[colName] !== undefined && row[colName] !== '') {
          norm._extra[field] = String(row[colName]).trim();
        }
      }

      return norm;
    }).filter(r => r.value !== null); // Remove rows without value

    return {
      fileName: file.name,
      fileSize: file.size,
      fileType: ext,
      headers: result.headers,
      colMap,
      rawRows: result.rows,
      normalizedRows: normalized,
      rowCount: normalized.length,
      errors: result.errors,
      parsedAt: new Date().toISOString(),
    };
  }

  // ---- Generate demo data ----
  function generateDemoBank() {
    const rows = [
      { date: '2026-06-01', value: 5000.00, desc: 'PIX RECEBIDO JOAO SILVA', ref: 'PIX001' },
      { date: '2026-06-01', value: -1200.00, desc: 'PAGAMENTO FORNECEDOR ABC LTDA', ref: 'TED002' },
      { date: '2026-06-02', value: 3500.00, desc: 'DEPOSITO CLIENTE MARIA SANTOS', ref: 'DEP003' },
      { date: '2026-06-03', value: -800.00, desc: 'DEBITO CONTA ENERGIA ELETRICA', ref: 'DEB004' },
      { date: '2026-06-04', value: 1250.00, desc: 'PIX RECEBIDO PEDRO OLIVEIRA', ref: 'PIX005' },
      { date: '2026-06-05', value: -2400.00, desc: 'PAGAMENTO ALUGUEL IMOVEL COMERCIAL', ref: 'TED006' },
      { date: '2026-06-06', value: 7800.00, desc: 'TRANSFERENCIA RECEBIDA EMPRESA XYZ', ref: 'TED007' },
      { date: '2026-06-07', value: -350.00, desc: 'DEBITO CONTA TELEFONE FIXO', ref: 'DEB008' },
      { date: '2026-06-08', value: 920.00, desc: 'PIX RECEBIDO ANA COSTA', ref: 'PIX009' },
      { date: '2026-06-09', value: -1500.00, desc: 'PAGAMENTO SALARIO FUNCIONARIO', ref: 'TED010' },
      { date: '2026-06-10', value: 4200.00, desc: 'DEPOSITO VENDA PRODUTO SERVICO', ref: 'DEP011' },
      { date: '2026-06-11', value: -600.00, desc: 'DEBITO CONTA INTERNET BANDA LARGA', ref: 'DEB012' },
      { date: '2026-06-12', value: 2100.00, desc: 'PIX RECEBIDO CARLOS FERREIRA', ref: 'PIX013' },
      { date: '2026-06-13', value: -980.00, desc: 'PAGAMENTO NOTA FISCAL 12345', ref: 'NF014' },
      { date: '2026-06-14', value: 6300.00, desc: 'TRANSFERENCIA RECEBIDA CLIENTE VIP', ref: 'TED015' },
      { date: '2026-06-15', value: -450.00, desc: 'DEBITO CONTA SEGURO VEICULO', ref: 'DEB016' },
      { date: '2026-06-16', value: 1800.00, desc: 'PIX RECEBIDO LUCIA MENDES', ref: 'PIX017' },
      { date: '2026-06-17', value: -3200.00, desc: 'PAGAMENTO FORNECEDOR DEF COMERCIO', ref: 'TED018' },
      { date: '2026-06-18', value: 5500.00, desc: 'DEPOSITO CHEQUE COMPENSADO', ref: 'CHQ019' },
      { date: '2026-06-19', value: -720.00, desc: 'DEBITO CONTA AGUA SANEAMENTO', ref: 'DEB020' },
      // N x 1 Demo: Single bank payment for grouped NF items
      { date: '2026-06-20', value: -1000.00, desc: 'PIX FORNECEDOR ABC MATERIAIS', ref: 'PIX021' },
      // Subset Sum Demo: Single payment that matches a combination of ERP items
      { date: '2026-06-22', value: -1850.00, desc: 'TED PAGAMENTO DIVERSOS FORNECEDORES', ref: 'TED022' },
    ];
    return { fileName: 'extrato_banco_demo.csv', fileType: 'csv', normalizedRows: rows.map((r, i) => ({ _id: i, ...r, _extra: {} })), rowCount: rows.length, parsedAt: new Date().toISOString() };
  }

  function generateDemoSystem() {
    const rows = [
      { date: '2026-06-01', value: 5000.00, desc: 'RECEBIMENTO CLIENTE JOAO SILVA REF JUNHO', ref: 'REC001', _extra: {} },
      { date: '2026-06-01', value: -1200.00, desc: 'PAGAMENTO FORNECEDOR ABC', ref: 'PAG002', _extra: {} },
      { date: '2026-06-02', value: 3500.00, desc: 'RECEBIMENTO MARIA SANTOS VENDA PRODUTO', ref: 'REC003', _extra: {} },
      { date: '2026-06-03', value: -800.00, desc: 'PAGAMENTO ENERGIA ELETRICA JUNHO 2026', ref: 'PAG004', _extra: {} },
      { date: '2026-06-04', value: 1250.00, desc: 'RECEBIMENTO PEDRO OLIVEIRA SERVICO', ref: 'REC005', _extra: {} },
      { date: '2026-06-05', value: -2400.00, desc: 'PAGAMENTO ALUGUEL JUNHO 2026', ref: 'PAG006', _extra: {} },
      { date: '2026-06-06', value: 7800.00, desc: 'RECEBIMENTO EMPRESA XYZ CONTRATO', ref: 'REC007', _extra: {} },
      { date: '2026-06-07', value: -350.00, desc: 'PAGAMENTO TELEFONE JUNHO', ref: 'PAG008', _extra: {} },
      { date: '2026-06-08', value: 920.00, desc: 'RECEBIMENTO ANA COSTA CONSULTORIA', ref: 'REC009', _extra: {} },
      { date: '2026-06-09', value: -1500.00, desc: 'PAGAMENTO SALARIO JOSE FUNC', ref: 'PAG010', _extra: {} },
      { date: '2026-06-11', value: 4200.00, desc: 'RECEBIMENTO VENDA SERVICOS JUNHO', ref: 'REC011', _extra: {} },
      { date: '2026-06-11', value: -600.00, desc: 'PAGAMENTO INTERNET PROVEDOR', ref: 'PAG012', _extra: {} },
      { date: '2026-06-13', value: 2100.00, desc: 'RECEBIMENTO CARLOS FERREIRA PRODUTO', ref: 'REC013', _extra: {} },
      { date: '2026-06-14', value: -980.00, desc: 'PAGAMENTO NF 12345 MERCADORIA', ref: 'PAG014', _extra: {} },
      { date: '2026-06-14', value: 6300.00, desc: 'RECEBIMENTO CLIENTE VIP PREMIUM', ref: 'REC015', _extra: {} },
      // Extra entries to show divergences:
      { date: '2026-06-20', value: 2800.00, desc: 'RECEBIMENTO CLIENTE NOVO PEDIDO', ref: 'REC021', _extra: {} }, // not in bank
      { date: '2026-06-16', value: -460.00, desc: 'PAGAMENTO SEGURO AUTOMOVEL', ref: 'PAG022', _extra: {} }, // value diff
      { date: '2026-06-17', value: 1800.00, desc: 'RECEBIMENTO LUCIA MENDES PROJETO', ref: 'REC023', _extra: {} },
      { date: '2026-06-18', value: -3200.00, desc: 'PAGAMENTO DEF COMERCIO NOTA', ref: 'PAG024', _extra: {} },
      // === N x 1 Demo: 3 items from same invoice NF-4587 ===
      { date: '2026-06-20', value: -300.00, desc: 'MATERIAL ESCRITORIO ITEM 1', ref: 'NF-4587', _extra: { notaFiscal: 'NF-4587', fornecedor: 'ABC MATERIAIS' } },
      { date: '2026-06-20', value: -250.00, desc: 'TONER IMPRESSORA ITEM 2', ref: 'NF-4587', _extra: { notaFiscal: 'NF-4587', fornecedor: 'ABC MATERIAIS' } },
      { date: '2026-06-20', value: -450.00, desc: 'PAPEL A4 RESMA ITEM 3', ref: 'NF-4587', _extra: { notaFiscal: 'NF-4587', fornecedor: 'ABC MATERIAIS' } },
      // === Subset Sum Demo: 3 items without common identifier, sum = 1850 ===
      { date: '2026-06-22', value: -700.00, desc: 'PAGAMENTO FRETE TRANSPORTADORA ALPHA', ref: 'PAG030', _extra: {} },
      { date: '2026-06-22', value: -850.00, desc: 'PAGAMENTO SERVICO MANUTENCAO', ref: 'PAG031', _extra: {} },
      { date: '2026-06-22', value: -300.00, desc: 'PAGAMENTO MATERIAL LIMPEZA', ref: 'PAG032', _extra: {} },
    ];
    return { fileName: 'relatorio_sistema_demo.csv', fileType: 'csv', normalizedRows: rows.map((r, i) => ({ _id: i, ...r, _extra: r._extra || {} })), rowCount: rows.length, parsedAt: new Date().toISOString() };
  }

  return { parseFile, generateDemoBank, generateDemoSystem };
})();
