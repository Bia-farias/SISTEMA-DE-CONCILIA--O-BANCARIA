/**
 * ocr.js – OCR Engine via Groq Vision (Llama 4 Scout)
 *
 * Suporta: PDF (via PDF.js), JPEG, PNG
 * Usa Groq API para extrair tabelas com alta precisão.
 * Depende de: CONFIG, NORMALIZER, PDF.js (CDN)
 */

const OCR_ENGINE = (() => {

  // ----------------------------------------------------------------
  // PROMPT especializado para documentos financeiros brasileiros
  // ----------------------------------------------------------------
  const EXTRACTION_PROMPT = `Você é um especialista em extração de dados de documentos financeiros e bancários brasileiros.

Analise cuidadosamente esta imagem de documento financeiro/bancário.

TAREFA: Identifique TODAS as tabelas presentes na imagem e extraia os dados completos.

REGRAS IMPORTANTES:
1. Preserve EXATAMENTE os valores numéricos, datas e textos como aparecem no documento
2. Para valores monetários: mantenha o formato original (ex: "1.500,00" ou "R$ 1.500,00")
3. Para datas: mantenha o formato original (ex: "01/06/2026" ou "2026-06-01")
4. Se uma célula estiver vazia, use null
5. Identifique corretamente qual é o cabeçalho de cada coluna
6. Se houver múltiplas tabelas, extraia TODAS elas separadamente

FORMATO DE RESPOSTA (retorne APENAS o JSON, sem texto adicional):
{
  "tables": [
    {
      "title": "nome ou descrição da tabela (ou null se não identificado)",
      "headers": ["Coluna1", "Coluna2", "Coluna3"],
      "rows": [
        ["valor1", "valor2", "valor3"],
        ["valor4", "valor5", "valor6"]
      ],
      "confidence": 95
    }
  ],
  "document_type": "extrato bancário | nota fiscal | relatório ERP | outro",
  "total_tables": 1
}`;

  // ----------------------------------------------------------------
  // Callbacks de progresso para a UI
  // ----------------------------------------------------------------
  let _onProgress = null;

  function setProgressCallback(fn) {
    _onProgress = fn;
  }

  function reportProgress(step, message, pct) {
    if (_onProgress) _onProgress(step, message, pct);
  }

  // ----------------------------------------------------------------
  // Converter File para base64
  // ----------------------------------------------------------------
  async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => resolve(e.target.result.split(',')[1]); // remove "data:...;base64,"
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  }

  // ----------------------------------------------------------------
  // Verificar tamanho da imagem (Groq: máx 4MB base64)
  // ----------------------------------------------------------------
  function checkImageSize(base64Str) {
    const sizeBytes = (base64Str.length * 3) / 4;
    const maxBytes  = CONFIG.OCR_MAX_IMAGE_SIZE || (4 * 1024 * 1024);
    if (sizeBytes > maxBytes) {
      throw new Error(`Imagem muito grande (${(sizeBytes / 1024 / 1024).toFixed(1)}MB). Máximo permitido: ${(maxBytes / 1024 / 1024).toFixed(0)}MB.`);
    }
    return true;
  }

  // ----------------------------------------------------------------
  // Renderizar PDF em imagens base64 (via PDF.js)
  // ----------------------------------------------------------------
  async function renderPDFtoBase64Pages(file) {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF.js não carregado. Verifique a conexão com a internet.');
    }

    const scale  = CONFIG.PDF_RENDER_SCALE || 2.0;
    const maxPgs = CONFIG.OCR_MAX_PDF_PAGES || 10;

    // Ler o arquivo como ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf         = await loadingTask.promise;

    const totalPages = Math.min(pdf.numPages, maxPgs);
    const pages      = [];

    for (let i = 1; i <= totalPages; i++) {
      reportProgress('pdf', `Renderizando página ${i} de ${totalPages}...`, Math.round((i / totalPages) * 40));

      const page     = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });

      const canvas    = document.createElement('canvas');
      canvas.width    = viewport.width;
      canvas.height   = viewport.height;
      const ctx       = canvas.getContext('2d');

      await page.render({ canvasContext: ctx, viewport }).promise;

      // Converter canvas para base64 JPEG (melhor compressão que PNG)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const base64  = dataUrl.split(',')[1];

      pages.push({ pageNum: i, base64, mimeType: 'image/jpeg' });
      canvas.remove();
    }

    return pages;
  }

  // ----------------------------------------------------------------
  // Tentar extrair texto direto de PDF (PDFs digitais, sem OCR)
  // ----------------------------------------------------------------
  async function extractPDFTextDirect(file) {
    if (typeof pdfjsLib === 'undefined') return null;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf         = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let   fullText    = '';

      for (let i = 1; i <= Math.min(pdf.numPages, CONFIG.OCR_MAX_PDF_PAGES || 10); i++) {
        const page    = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
      }

      // Se extraiu texto significativo, este é um PDF digital
      const wordCount = fullText.trim().split(/\s+/).length;
      return wordCount > 20 ? fullText : null;

    } catch {
      return null;
    }
  }

  // ----------------------------------------------------------------
  // Função privada compartilhada — envia mensagens para a API Groq
  // Fix #4: elimina código duplicado entre callGroqVision e callGroqWithText
  // ----------------------------------------------------------------
  async function _callGroqAPI(messages) {
    if (!CONFIG.GROQ_API_KEY || CONFIG.GROQ_API_KEY.includes('COLE_SUA')) {
      throw new Error('Chave da API Groq não configurada. Edite o arquivo js/config.js.');
    }

    const response = await fetch(CONFIG.GROQ_BASE_URL, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.GROQ_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:       CONFIG.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages,
        max_tokens:  8192,
        temperature: 0.1,  // Baixo para respostas determinísticas/precisas
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      let errMsg = `Groq API erro ${response.status}`;
      try {
        const errJson = JSON.parse(errBody);
        errMsg = errJson?.error?.message || errMsg;
      } catch { /* mantém errMsg padrão */ }
      throw new Error(errMsg);
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || '';
  }

  // ----------------------------------------------------------------
  // Chamar Groq Vision API (imagens base64)
  // ----------------------------------------------------------------
  async function callGroqVision(images) {
    const content = [
      { type: 'text', text: EXTRACTION_PROMPT },
      ...images.map(img => ({
        type: 'image_url',
        image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
      })),
    ];
    return _callGroqAPI([{ role: 'user', content }]);
  }

  // ----------------------------------------------------------------
  // Chamar Groq com texto direto (PDFs digitais já têm texto extraível)
  // ----------------------------------------------------------------
  async function callGroqWithText(text) {
    const prompt = `${EXTRACTION_PROMPT}\n\nTexto extraído do documento:\n${text}`;
    return _callGroqAPI([{ role: 'user', content: prompt }]);
  }

  // ----------------------------------------------------------------
  // Parsear resposta JSON do Groq
  // ----------------------------------------------------------------
  function parseGroqResponse(rawText) {
    // Tentar extrair JSON de dentro de bloco de código, se houver
    let jsonStr = rawText.trim();

    // Remover blocos ```json ... ``` se presentes
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    // Tentar encontrar objeto JSON mesmo sem blocos
    const objMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objMatch) {
      jsonStr = objMatch[0];
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error('[OCR] Resposta Groq não é JSON válido:', rawText);
      throw new Error('Groq retornou resposta inválida. Tente novamente ou com imagem mais nítida.');
    }

    if (!parsed.tables || !Array.isArray(parsed.tables)) {
      throw new Error('Nenhuma tabela identificada no documento. Verifique se a imagem está legível.');
    }

    return parsed;
  }

  // ----------------------------------------------------------------
  // Normalizar tabelas extraídas para formato do sistema
  // ----------------------------------------------------------------
  function normalizeExtractedTables(parsedResult) {
    const normalized = [];

    for (const table of parsedResult.tables) {
      if (!table.headers || !table.rows || table.rows.length === 0) continue;

      const headers = table.headers.map(h => String(h || '').trim());

      // Detectar mapeamento de colunas usando o NORMALIZER existente
      const colMap = NORMALIZER.detectColumns(headers);

      const rows = table.rows
        .filter(row => Array.isArray(row) && row.some(cell => cell !== null && cell !== ''))
        .map((row, idx) => {
          // Mapear células às colunas pelo índice
          const rowObj = {};
          headers.forEach((h, i) => {
            rowObj[h] = row[i] !== undefined ? String(row[i] || '').trim() : '';
          });

          // Normalizar usando o sistema existente
          const dateRaw  = rowObj[colMap.date]  || rowObj['Data']    || rowObj['DATA']    || '';
          const valueRaw = rowObj[colMap.value]  || rowObj['Valor']   || rowObj['VALOR']   || rowObj['Crédito'] || rowObj['Débito'] || '';
          const descRaw  = rowObj[colMap.desc]   || rowObj['Descrição'] || rowObj['DESCRICAO'] || rowObj['Histórico'] || '';
          const refRaw   = rowObj[colMap.ref]    || rowObj['Documento'] || rowObj['Referência'] || '';

          const normalizedDate  = NORMALIZER.normalizeDate(dateRaw);
          const normalizedValue = NORMALIZER.normalizeValue(valueRaw);

          // Pular linhas sem valor nem data (provavelmente totalizadores ou linhas em branco)
          if (normalizedValue === null && !normalizedDate) return null;

          return {
            _id:   idx,
            _raw:  rowObj,
            date:  normalizedDate,
            value: normalizedValue,
            desc:  NORMALIZER.normalizeText(descRaw),
            ref:   String(refRaw).trim(),
            _extra: {},
          };
        })
        .filter(r => r !== null && r.value !== null);

      if (rows.length > 0) {
        normalized.push({
          title:      table.title || `Tabela ${normalized.length + 1}`,
          headers,
          colMap,
          rows,
          confidence: table.confidence || null,
          rowCount:   rows.length,
        });
      }
    }

    return normalized;
  }

  // ----------------------------------------------------------------
  // Ponto de entrada principal
  // ----------------------------------------------------------------
  async function processFile(file, onProgress) {
    if (onProgress) setProgressCallback(onProgress);

    const ext      = file.name.split('.').pop().toLowerCase();
    const isPDF    = ext === 'pdf';
    const isImage  = ['jpg', 'jpeg', 'png'].includes(ext);

    if (!isPDF && !isImage) {
      throw new Error(`Formato não suportado para OCR: .${ext}`);
    }

    let rawGroqResponse;
    let documentType = 'unknown';

    // ---- PDF ----
    if (isPDF) {
      reportProgress('init', 'Analisando PDF...', 5);

      // Tentar extração de texto direto primeiro (mais rápido e preciso)
      const directText = await extractPDFTextDirect(file);

      if (directText && directText.length > 100) {
        // PDF digital — enviar texto direto ao Groq
        reportProgress('groq', 'Enviando texto do PDF ao Groq...', 30);
        rawGroqResponse = await callGroqWithText(directText);
      } else {
        // PDF escaneado — renderizar páginas como imagem
        reportProgress('pdf', 'Renderizando páginas do PDF...', 10);
        const pages = await renderPDFtoBase64Pages(file);

        if (pages.length === 0) {
          throw new Error('Não foi possível renderizar o PDF.');
        }

        // Groq aceita até 5 imagens por vez — processar em lotes
        reportProgress('groq', 'Enviando para Groq Vision...', 50);

        const batchSize = 5;
        const allRaws   = [];

        for (let i = 0; i < pages.length; i += batchSize) {
          const batch = pages.slice(i, i + batchSize);
          const raw   = await callGroqVision(batch);
          allRaws.push(raw);
        }

        // Se múltiplos lotes, usar apenas o primeiro (mais completo)
        rawGroqResponse = allRaws[0];
      }

    // ---- JPEG / PNG ----
    } else {
      reportProgress('init', 'Lendo imagem...', 10);
      const base64   = await fileToBase64(file);

      checkImageSize(base64);

      const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

      reportProgress('groq', 'Enviando para Groq Vision...', 30);
      rawGroqResponse = await callGroqVision([{ base64, mimeType }]);
    }

    // ---- Parsear resposta ----
    reportProgress('parse', 'Detectando tabelas...', 75);
    const parsedResult = parseGroqResponse(rawGroqResponse);
    documentType       = parsedResult.document_type || 'desconhecido';

    // ---- Normalizar ----
    reportProgress('normalize', 'Normalizando dados...', 88);
    const normalizedTables = normalizeExtractedTables(parsedResult);

    if (normalizedTables.length === 0) {
      throw new Error('Nenhuma tabela com dados válidos foi identificada no documento.');
    }

    reportProgress('done', 'Extração concluída!', 100);

    // Calcular confiança média
    const avgConfidence = normalizedTables.reduce((sum, t) => {
      return sum + (t.confidence || 80);
    }, 0) / normalizedTables.length;

    return {
      tables:       normalizedTables,
      documentType,
      confidence:   Math.round(avgConfidence),
      rawResponse:  rawGroqResponse,
      pageCount:    isPDF ? undefined : 1,
      // Para compatibilidade com o sistema:
      // A tabela principal (mais linhas) é a padrão
      primaryTable: normalizedTables.reduce((best, t) =>
        t.rowCount > (best?.rowCount || 0) ? t : best, null),
    };
  }

  // ----------------------------------------------------------------
  // Construir resultado no formato de PARSER.parseFile() para
  // injeção direta no pipeline de conciliação
  // ----------------------------------------------------------------
  function buildParserResult(ocrResult, selectedTables) {
    // Combinar linhas das tabelas selecionadas
    const allRows = [];
    let   idx     = 0;

    for (const table of selectedTables) {
      for (const row of table.rows) {
        allRows.push({ ...row, _id: idx++ });
      }
    }

    const primaryTable = selectedTables[0];

    return {
      fileName:       'documento_ocr',
      fileSize:       0,
      fileType:       'ocr',
      headers:        primaryTable?.headers || [],
      colMap:         primaryTable?.colMap  || {},
      rawRows:        allRows.map(r => r._raw),
      normalizedRows: allRows,
      rowCount:       allRows.length,
      errors:         [],
      parsedAt:       new Date().toISOString(),
      // Metadados extras do OCR
      _ocr: {
        documentType: ocrResult.documentType,
        confidence:   ocrResult.confidence,
        tablesFound:  ocrResult.tables.length,
      },
    };
  }

  return {
    processFile,
    buildParserResult,
    setProgressCallback,
  };
})();
